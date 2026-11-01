/**
 * Coding-mode host half: a small, workspace-confined read API plus a single
 * write endpoint, mounted on the web server under `/coding-mode`.
 *
 * The browser half cannot touch the filesystem, so this half answers three
 * requests and nothing else:
 *
 *   GET  /coding-mode/tree?root=<abs>&path=<rel>   directory listing
 *   GET  /coding-mode/file?root=<abs>&path=<rel>   UTF-8 text of one file
 *   PUT  /coding-mode/file                         { root, path, content }
 *
 * Every request names an absolute `root`; each resolved path must stay inside
 * it. Symlinks are not followed out of the root because paths are resolved
 * lexically and then `realpath`-checked before use.
 */
import { promises as fs } from 'node:fs';
import { resolve, sep, dirname, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHighlighter } from 'shiki';

const execFileAsync = promisify(execFile);

export const name = 'coding-mode';

/** The web server is the only service this half needs. */
export const inject = ['webServer'];

/** Refuse to inline files above this size; the caller is told they were cut. */
const MAX_READ_BYTES = 2 * 1024 * 1024;

/** Larger than this and highlighting would cost more than it is worth; the client falls back to plain text. */
const MAX_HIGHLIGHT_BYTES = 512 * 1024;

/** Files above this are skipped by search rather than read in full. */
const SEARCH_FILE_BYTES = 512 * 1024;

/** Ceiling on files opened by one search; the walk stops and reports truncation. */
const SEARCH_SCAN_LIMIT = 20000;

/** Wall-clock budget for one search, so a huge tree cannot hold the request open. */
const SEARCH_DEADLINE_MS = 5000;

/** Budget for one `git status`, so a wedged repository cannot hold the request open. */
const GIT_TIMEOUT_MS = 5000;

/** Paired palettes: one per colour scheme, so a theme switch only changes the request. */
const THEMES = { light: 'github-light', dark: 'github-dark' };

/** Extension to shiki language id. Unknown extensions highlight as plain text. */
const LANGUAGES = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'jsonc', md: 'markdown', markdown: 'markdown',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'fish',
  yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini',
  css: 'css', scss: 'scss', less: 'less', html: 'html', vue: 'vue', svelte: 'svelte',
  sql: 'sql', xml: 'xml', diff: 'diff', patch: 'diff', dockerfile: 'dockerfile',
};

/** One highlighter for the process; grammars load on demand and stay loaded. */
let highlighterPromise;
const loadedLanguages = new Set();

/** Cap on one write, matching the read ceiling's order of magnitude. */
const MAX_WRITE_BYTES = 10 * 1024 * 1024;

/** Cap on a JSON request body. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

/**
 * Directory names that are never worth expanding in a coding tree. They stay
 * addressable by explicit path; only the default listing hides them.
 */
const HIDDEN = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  'target',
]);

/** Write one JSON response. */
function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

/** Report a failure with a stable machine-readable code. */
function fail(res, status, code, message) {
  json(res, status, { error: { code, message } });
}

/**
 * Resolve `target` beneath `root` and refuse anything that escapes it.
 * @param root - absolute workspace root supplied by the caller.
 * @param target - relative path inside the root; empty means the root itself.
 */
function resolveInside(root, target) {
  if (typeof root !== 'string' || !root.startsWith('/')) {
    const error = new Error('root must be an absolute path');
    error.code = 'bad-root';
    throw error;
  }
  const absRoot = resolve(root);
  const abs = resolve(absRoot, target || '.');
  if (abs !== absRoot && !abs.startsWith(absRoot + sep)) {
    const error = new Error('path escapes the root');
    error.code = 'outside-root';
    throw error;
  }
  return { absRoot, abs };
}

/** Map a filesystem error onto the response code the browser half expects. */
function classify(error) {
  const code = error && error.code;
  if (code === 'ENOENT') return [404, 'not-found'];
  if (code === 'EACCES' || code === 'EPERM') return [403, 'denied'];
  if (code === 'EISDIR') return [400, 'is-directory'];
  if (code === 'ENOTDIR') return [400, 'not-directory'];
  if (code === 'ENOSPC') return [507, 'no-space'];
  if (code === 'outside-root' || code === 'bad-root') return [400, code];
  return [500, 'internal'];
}

/** Read a directory into the shape the file tree renders. */
async function listDirectory(root, target) {
  const { absRoot, abs } = resolveInside(root, target);
  const handle = await fs.opendir(abs);
  const entries = [];
  for await (const entry of handle) {
    if (HIDDEN.has(entry.name)) continue;
    const child = abs === absRoot ? entry.name : abs.slice(absRoot.length + 1) + '/' + entry.name;
    let size = 0;
    if (entry.isFile()) {
      try {
        size = (await fs.stat(abs + '/' + entry.name)).size;
      } catch {
        size = 0;
      }
    }
    entries.push({
      name: entry.name,
      path: child,
      dir: entry.isDirectory(),
      size,
    });
  }
  entries.sort((left, right) => {
    if (left.dir !== right.dir) return left.dir ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  });
  return { root: absRoot, path: abs === absRoot ? '' : abs.slice(absRoot.length + 1), entries };
}

/** Read one file as text, reporting whether the read hit the ceiling. */
async function readFile(root, target) {
  const { absRoot, abs } = resolveInside(root, target);
  const stat = await fs.stat(abs);
  if (stat.isDirectory()) {
    const error = new Error('path is a directory');
    error.code = 'EISDIR';
    throw error;
  }
  const handle = await fs.open(abs, 'r');
  try {
    const length = Math.min(stat.size, MAX_READ_BYTES);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    return {
      root: absRoot,
      path: abs.slice(absRoot.length + 1),
      name: basename(abs),
      content: text,
      size: stat.size,
      truncated: stat.size > MAX_READ_BYTES,
      binary: text.includes('\u0000'),
      mtimeMs: stat.mtimeMs,
    };
  } finally {
    await handle.close();
  }
}

/** Shiki language id for a path, or `text` when the extension is unknown. */
function shikiLanguage(path) {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  if (dot <= slash) return 'text';
  return LANGUAGES[path.slice(dot + 1).toLowerCase()] ?? 'text';
}

/** Load the shared highlighter, dropping a failed attempt instead of caching it. */
async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: [] }).catch((error) => {
      highlighterPromise = undefined;
      throw error;
    });
  }
  return highlighterPromise;
}

/**
 * Highlight one file for one colour scheme.
 * @param root - absolute workspace root.
 * @param target - path inside the root.
 * @param scheme - `light` or `dark`; anything else means dark.
 * @returns shiki HTML, or a typed refusal the client renders as plain text.
 */
async function highlightFile(root, target, scheme) {
  const { absRoot, abs } = resolveInside(root, target);
  const stat = await fs.stat(abs);
  if (stat.isDirectory()) {
    const error = new Error('path is a directory');
    error.code = 'EISDIR';
    throw error;
  }
  const relative = abs.slice(absRoot.length + 1);
  const lang = shikiLanguage(relative);
  if (stat.size > MAX_HIGHLIGHT_BYTES) {
    return { root: absRoot, path: relative, lang, tooLarge: true };
  }
  const text = await fs.readFile(abs, 'utf8');
  if (text.includes('\u0000')) {
    return { root: absRoot, path: relative, lang, binary: true };
  }
  const highlighter = await getHighlighter();
  let language = lang;
  if (language !== 'text' && !loadedLanguages.has(language)) {
    try {
      await highlighter.loadLanguage(language);
      loadedLanguages.add(language);
    } catch {
      language = 'text';
    }
  }
  const theme = scheme === 'light' ? THEMES.light : THEMES.dark;
  return {
    root: absRoot,
    path: relative,
    lang,
    theme,
    size: stat.size,
    html: highlighter.codeToHtml(text, { lang: language, theme }),
  };
}

/**
 * Search every text file under the root for a literal needle.
 * @param root - absolute workspace root.
 * @param needle - text to look for, matched case-insensitively.
 * @param limit - maximum number of matching lines to return.
 */
async function searchWorkspace(root, needle, limit) {
  const { absRoot } = resolveInside(root, '');
  const lower = needle.toLowerCase();
  const results = [];
  const deadline = Date.now() + SEARCH_DEADLINE_MS;
  let scanned = 0;
  let files = 0;
  let truncated = false;

  const walk = async (dir) => {
    if (results.length >= limit || Date.now() > deadline) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
    for (const entry of entries) {
      if (results.length >= limit || Date.now() > deadline) {
        truncated = true;
        return;
      }
      if (HIDDEN.has(entry.name)) continue;
      const abs = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (++scanned > SEARCH_SCAN_LIMIT) {
        truncated = true;
        return;
      }
      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        continue;
      }
      if (stat.size > SEARCH_FILE_BYTES) continue;
      let text;
      try {
        text = await fs.readFile(abs, 'utf8');
      } catch {
        continue;
      }
      if (!text.includes(needle) && !text.toLowerCase().includes(lower)) continue;
      if (text.includes('\u0000')) continue;
      files += 1;
      const relative = abs.slice(absRoot.length + 1);
      const lines = text.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (results.length >= limit) {
          truncated = true;
          break;
        }
        if (lines[index].toLowerCase().includes(lower)) {
          results.push({ path: relative, line: index + 1, text: lines[index].trim().slice(0, 300) });
        }
      }
    }
  };

  await walk(absRoot);
  return { root: absRoot, query: needle, results, scanned, files, truncated };
}

/** Collapse a two-character porcelain code into the single letter the tree shows. */
function letterFor(code) {
  if (code[0] === '?' || code[1] === '?') return 'U';
  if (code[0] === 'U' || code[1] === 'U') return '!';
  if (code[0] === 'R' || code[1] === 'R') return 'R';
  if (code[0] === 'C' || code[1] === 'C') return 'C';
  if (code[0] === 'A' || code[1] === 'A') return 'A';
  if (code[0] === 'D' || code[1] === 'D') return 'D';
  return 'M';
}

/**
 * Read the working tree's status for a directory.
 * A directory that is not a repository is a normal answer, not an error.
 * @param root - absolute workspace root.
 */
async function gitStatus(root) {
  const { absRoot } = resolveInside(root, '');
  let stdout;
  try {
    const result = await execFileAsync(
      'git',
      ['-C', absRoot, 'status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all'],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (error) {
    if (error && error.code === 'ENOENT') return { root: absRoot, available: false, reason: 'git-not-installed' };
    return { root: absRoot, available: false, reason: 'not-a-repository' };
  }

  const fields = stdout.split('\0');
  const statuses = {};
  let branch = null;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;
    if (field.startsWith('## ')) {
      branch = field.slice(3).split('...')[0].split(' ')[0] || null;
      continue;
    }
    const code = field.slice(0, 2);
    const path = field.slice(3);
    if (!path) continue;
    // A rename or copy carries the original path as the following NUL-separated field.
    if (code[0] === 'R' || code[0] === 'C') index += 1;
    statuses[path] = letterFor(code);
  }
  return { root: absRoot, available: true, branch, statuses };
}

/** Replace one file's contents with the supplied text. */
async function writeFile(root, target, content) {
  const { absRoot, abs } = resolveInside(root, target);
  if (typeof content !== 'string') {
    const error = new Error('content must be a string');
    error.code = 'bad-content';
    throw error;
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) {
    const error = new Error('content exceeds the write ceiling');
    error.code = 'too-large';
    throw error;
  }
  await fs.mkdir(dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  const stat = await fs.stat(abs);
  return { root: absRoot, path: abs.slice(absRoot.length + 1), size: stat.size, mtimeMs: stat.mtimeMs };
}

/** Read a bounded JSON request body. */
async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('request body too large');
      error.code = 'too-large';
      throw error;
    }
    chunks.push(chunk);
  }
  if (total === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/**
 * One request handler for the whole `/coding-mode` prefix.
 * @param req - node request.
 * @param res - node response.
 */
async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.pathname.replace(/^\/coding-mode/, '') || '/';

  try {
    if (route === '/tree' && req.method === 'GET') {
      const listing = await listDirectory(url.searchParams.get('root') ?? '', url.searchParams.get('path') ?? '');
      json(res, 200, listing);
      return;
    }
    if (route === '/file' && req.method === 'GET') {
      const file = await readFile(url.searchParams.get('root') ?? '', url.searchParams.get('path') ?? '');
      json(res, 200, file);
      return;
    }
    if (route === '/git' && req.method === 'GET') {
      json(res, 200, await gitStatus(url.searchParams.get('root') ?? ''));
      return;
    }
    if (route === '/search' && req.method === 'GET') {
      const needle = (url.searchParams.get('q') ?? '').trim();
      if (needle === '') {
        json(res, 200, { query: '', results: [], scanned: 0, files: 0, truncated: false });
        return;
      }
      const asked = Number(url.searchParams.get('limit'));
      const limit = Math.min(Math.max(Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : 200, 1), 500);
      json(res, 200, await searchWorkspace(url.searchParams.get('root') ?? '', needle, limit));
      return;
    }
    if (route === '/highlight' && req.method === 'GET') {
      const scheme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';
      json(res, 200, await highlightFile(url.searchParams.get('root') ?? '', url.searchParams.get('path') ?? '', scheme));
      return;
    }
    if (route === '/file' && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const saved = await writeFile(body.root, body.path, body.content);
      json(res, 200, saved);
      return;
    }
    fail(res, 404, 'no-route', `unknown coding-mode route ${req.method ?? 'GET'} ${route}`);
  } catch (error) {
    const [status, code] = classify(error);
    fail(res, status, code, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Host plugin body: register the prefix route for this plugin's lifetime.
 * @param ctx - host context; `inject` names the web server it needs.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (web) => {
    web.effect(
      () => web.webServer.register({ kind: 'prefix', path: '/coding-mode', handler: handle }),
      'coding-mode: /coding-mode routes',
    );
  });
}

/**
 * Coding-mode browser half.
 *
 * Registers one global main panel ("coding-mode") holding a VS Code-like
 * workbench — workspace file tree on the left, a multi-tab editor on the right
 * — plus the sidebar rail icon that selects it.
 *
 * This bundle is hand-authored in the loader's CommonJS factory format, so it
 * needs no build step: the shell registers the factory and materializes it on
 * first use. The only external it requires is `react`, which is part of the
 * platform's shared module table.
 */
window.__ModuleLoader__.load({
	id: "@local/dsh-coding-mode",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const h = react.createElement;
		const { useState, useEffect, useMemo, useRef, useCallback } = react;

		const STYLE_ID = "dsh-coding-mode/style";

		const css = `
.dcm-root { display: flex; flex-direction: row; height: 100%; min-height: 0; overflow: hidden;
  background: var(--dsw-alias-bg-base, #fff); color: inherit; }
.dcm-tree { width: 248px; flex: 0 0 auto; display: flex; flex-direction: column; min-height: 0;
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-layer-2, #fafafa));
  border-right: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.22)); }
.dcm-tree-head { display: flex; align-items: center; gap: 8px; padding: 10px 10px 8px; font-size: 12px; }
.dcm-tree-label { letter-spacing: .02em; opacity: .6; flex: 0 0 auto; text-transform: uppercase; }
.dcm-branch { flex: 0 1 auto; min-width: 0; font-size: 10.5px; opacity: .5; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dcm-branch:hover { opacity: .85; }
.dcm-badge { flex: 0 0 auto; font-size: 10.5px; font-weight: 700; line-height: 16px; padding: 0 3px; border-radius: 3px; }
.dcm-badge[data-kind="M"], .dcm-badge[data-kind="●"] { color: #d19a66; }
.dcm-badge[data-kind="A"], .dcm-badge[data-kind="U"] { color: #4caf50; }
.dcm-badge[data-kind="D"], .dcm-badge[data-kind="!"] { color: #e06c75; }
.dcm-badge[data-kind="R"], .dcm-badge[data-kind="C"] { color: #61afef; }
.dcm-select { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 11.5px; padding: 2px 4px;
  border-radius: var(--dsw-radius-sm, 6px); border: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.3));
  background: var(--dsw-alias-bg-layer-1, transparent); color: inherit; cursor: pointer; }
.dcm-search { padding: 0 8px 8px; }
.dcm-input { width: 100%; box-sizing: border-box; font: inherit; font-size: 12.5px; padding: 4px 8px;
  border-radius: var(--dsw-radius-sm, 6px); border: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.3));
  background: var(--dsw-alias-bg-layer-1, transparent); color: inherit; }
.dcm-input:focus { outline: 1px solid var(--dsw-alias-brand-primary, #4d93f8); outline-offset: -1px; }
.dcm-hit { padding: 5px 8px; border-radius: 6px; cursor: pointer; }
.dcm-hit:hover { background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.12)); }
.dcm-hit-path { font-size: 11.5px; opacity: .62; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dcm-hit-text { font-family: var(--dsh-font-family-code, ui-monospace, monospace); font-size: 12px;
  white-space: pre; overflow: hidden; text-overflow: ellipsis; }
.dcm-meta { padding: 4px 8px 6px; font-size: 11.5px; opacity: .55; }
.dcm-tree-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 4px 12px; }
.dcm-row { display: flex; align-items: center; gap: 4px; height: 24px; padding: 0 6px;
  border-radius: var(--dsw-radius-sm, 6px); cursor: pointer; font-size: 13px; line-height: 24px;
  white-space: nowrap; user-select: none; }
.dcm-row:hover { background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.10)); }
.dcm-row[data-active="true"] { background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.14)); }
.dcm-caret { width: 12px; flex: 0 0 12px; opacity: .55; font-size: 9px; text-align: center; }
.dcm-name { overflow: hidden; text-overflow: ellipsis; }
.dcm-empty { padding: 18px 14px; font-size: 13px; line-height: 1.6; opacity: .6; }
.dcm-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.dcm-tabs { display: flex; align-items: stretch; height: 36px; flex: 0 0 auto; overflow-x: auto;
  overflow-y: hidden; border-bottom: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.22));
  background: var(--dsw-alias-bg-layer-1, transparent); }
.dcm-tab { display: flex; align-items: center; gap: 6px; padding: 0 10px; max-width: 220px;
  font-size: 12.5px; cursor: pointer; border-right: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.18));
  opacity: .72; white-space: nowrap; }
.dcm-tab[data-active="true"] { opacity: 1; box-shadow: inset 0 -2px 0 var(--dsw-alias-brand-primary, #4d93f8); }
.dcm-tab-label { overflow: hidden; text-overflow: ellipsis; }
.dcm-tab-x { opacity: .45; font-size: 14px; line-height: 1; padding: 0 2px; border-radius: 4px; }
.dcm-tab-x:hover { opacity: 1; background: rgba(127,127,127,.18); }
.dcm-actions { margin-left: auto; display: flex; align-items: center; gap: 2px; padding: 0 6px; flex: 0 0 auto; }
.dcm-btn { font: inherit; font-size: 12px; padding: 3px 9px; border-radius: var(--dsw-radius-sm, 6px);
  border: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.3)); background: transparent;
  color: inherit; cursor: pointer; white-space: nowrap; }
.dcm-btn:hover { background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.12)); }
.dcm-btn[disabled] { opacity: .4; cursor: default; }
.dcm-body { flex: 1 1 auto; min-height: 0; overflow: auto; position: relative; }
.dcm-code { display: flex; align-items: flex-start; min-height: 100%;
  font-family: var(--dsh-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: var(--dsh-code-font-size, 12.5px); line-height: 1.6; }
.dcm-gutter { flex: 0 0 auto; padding: 10px 8px 24px 14px; text-align: right; opacity: .34;
  user-select: none; white-space: pre; }
.dcm-source { flex: 1 1 auto; padding: 10px 18px 24px 6px; margin: 0; white-space: pre; tab-size: 2; }
.dcm-hl { height: 100%; overflow: auto; }
.dcm-hl pre.shiki { margin: 0; padding: 10px 18px 24px 6px; background: transparent !important;
  font-family: var(--dsh-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: var(--dsh-code-font-size, 12.5px); line-height: 1.6; white-space: pre; }
.dcm-hl pre.shiki code { counter-reset: dcm-line; }
.dcm-hl pre.shiki .line { display: block; counter-increment: dcm-line; padding-left: 3.4em; position: relative; }
.dcm-hl pre.shiki .line::before { content: counter(dcm-line); position: absolute; left: 0; top: 0;
  width: 2.6em; text-align: right; opacity: .34; user-select: none; }
.dcm-editor { width: 100%; min-height: 100%; box-sizing: border-box; border: 0; outline: none;
  resize: none; padding: 10px 18px 24px 14px; background: transparent; color: inherit;
  font-family: var(--dsh-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: var(--dsh-code-font-size, 12.5px); line-height: 1.6; tab-size: 2; }
.dcm-note { padding: 14px 18px; font-size: 13px; opacity: .6; }
.dcm-strip { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.18)); opacity: .75; }
.dcm-err { color: #d9534f; }
.dcm-root { position: relative; }
.dcm-menu { position: fixed; z-index: 40; min-width: 168px; padding: 4px;
  border-radius: 8px; background: var(--dsw-alias-bg-overlay, #fff);
  border: 1px solid var(--dsw-alias-border-l3, rgba(127,127,127,.28));
  box-shadow: 0 8px 24px rgba(0,0,0,.18); }
.dcm-menu-item { display: block; width: 100%; text-align: left; font: inherit; font-size: 12.5px;
  padding: 6px 10px; border: 0; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.dcm-menu-item:hover { background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.14)); }
.dcm-tree.dcm-overlay { position: absolute; top: 0; bottom: 0; left: 0; z-index: 5; width: 236px;
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l3, rgba(127,127,127,.25)), 14px 0 28px rgba(0,0,0,.14); }
`;

		/** Inject the workbench stylesheet once per module instance. */
		function ensureStyle() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID)) return;
			const tag = document.createElement("style");
			tag.id = STYLE_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		const BASE = "/coding-mode";

		/** Turn a non-OK response into a thrown error carrying the host's message. */
		async function toJson(response) {
			let payload = null;
			try {
				payload = await response.json();
			} catch {
				payload = null;
			}
			if (!response.ok) {
				const message = payload && payload.error && payload.error.message ? payload.error.message : `HTTP ${response.status}`;
				throw new Error(message);
			}
			return payload;
		}

		/** Read one directory beneath the workspace root. */
		function fetchTree(root, path, signal) {
			const query = `?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`;
			return fetch(BASE + "/tree" + query, { signal, cache: "no-store" }).then(toJson);
		}

		/** Read one file's text beneath the workspace root. */
		function fetchFile(root, path, signal) {
			const query = `?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`;
			return fetch(BASE + "/file" + query, { signal, cache: "no-store" }).then(toJson);
		}

		/** Save one file's text beneath the workspace root. */
		async function putFile(root, path, content) {
			const response = await fetch(BASE + "/file", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ root, path, content }),
			});
			return toJson(response);
		}

		/** Which palette the page is showing; the theme presenter marks it on `<body>`. */
		function currentScheme() {
			if (typeof document === "undefined" || !document.body) return "dark";
			return document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light";
		}

		/** Read one file highlighted by the host for the given colour scheme. */
		function fetchHighlight(root, path, scheme, signal) {
			const query = `?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}&theme=${scheme}`;
			return fetch(BASE + "/highlight" + query, { signal, cache: "no-store" }).then(toJson);
		}

		/** Search the workspace for a literal needle. */
		function fetchSearch(root, needle, signal) {
			const query = `?root=${encodeURIComponent(root)}&q=${encodeURIComponent(needle)}`;
			return fetch(BASE + "/search" + query, { signal, cache: "no-store" }).then(toJson);
		}

		/** Read the working tree's status; a non-repository answers `available: false`. */
		function fetchGit(root, signal) {
			const query = `?root=${encodeURIComponent(root)}`;
			return fetch(BASE + "/git" + query, { signal, cache: "no-store" }).then(toJson);
		}

		/** File-type glyph, kept deliberately simple: no icon font is available to a plugin. */
		function glyph(name, dir) {
			if (dir) return "▸";
			const dot = name.lastIndexOf(".");
			const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
			if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return "◈";
			if (ext === "json" || ext === "yaml" || ext === "yml" || ext === "toml") return "⚙";
			if (ext === "md" || ext === "txt" || ext === "rst") return "¶";
			if (ext === "css" || ext === "scss" || ext === "less") return "#";
			if (ext === "html" || ext === "vue" || ext === "svelte") return "<>";
			if (ext === "sh" || ext === "bash" || ext === "zsh") return "$";
			if (ext === "py") return "λ";
			return "·";
		}

		/** Format a byte count for the tree's status line. */
		function humanSize(bytes) {
			if (!bytes) return "";
			if (bytes < 1024) return `${bytes}B`;
			if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`;
			return `${(bytes / 1024 / 1024).toFixed(1)}M`;
		}

		/** Fence tag for a path's extension; empty means "no language". */
		function languageOf(path) {
			const dot = path.lastIndexOf(".");
			const slash = path.lastIndexOf("/");
			if (dot <= slash) return "";
			const ext = path.slice(dot + 1).toLowerCase();
			const fences = {
				ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js",
				json: "json", md: "md", py: "python", rb: "ruby", go: "go", rs: "rust",
				java: "java", kt: "kotlin", swift: "swift", c: "c", h: "c", cpp: "cpp",
				cs: "csharp", php: "php", sh: "bash", bash: "bash", zsh: "bash",
				yml: "yaml", yaml: "yaml", toml: "toml", css: "css", scss: "scss",
				html: "html", vue: "vue", svelte: "svelte", sql: "sql", xml: "xml",
			};
			return fences[ext] ?? "";
		}

		/**
		 * Line span of a DOM selection inside the rendered source.
		 * @param range - the live selection range.
		 * @param block - the `pre` holding the source text.
		 * @returns 1-based inclusive line numbers; both 1 when the range lies elsewhere.
		 */
		function lineRangeOf(range, block) {
			if (!block || !block.contains(range.startContainer) || !block.contains(range.endContainer)) {
				return { start: 1, end: 1 };
			}
			const head = document.createRange();
			head.selectNodeContents(block);
			head.setEnd(range.startContainer, range.startOffset);
			const start = head.toString().split("\n").length;
			const tail = document.createRange();
			tail.selectNodeContents(block);
			tail.setEnd(range.endContainer, range.endOffset);
			const shown = tail.toString();
			const end = Math.max(start, shown.split("\n").length - (shown.endsWith("\n") ? 1 : 0));
			return { start, end };
		}

		/**
		 * One tree row. Directories toggle; files open a tab.
		 * Children render from the parent's cache so expansion survives re-renders.
		 */
		function TreeRow(props) {
			const { entry, depth, expanded, cache, onToggle, onOpen, activePath, statuses, dirtyDirs } = props;
			const isOpen = expanded.has(entry.path);
			const children = cache.get(entry.path);
			/** Single-letter file status, or the aggregate dot for a directory holding changes. */
			const mark = entry.dir
				? dirtyDirs && dirtyDirs.has(entry.path)
					? "●"
					: ""
				: (statuses && statuses[entry.path]) || "";
			return h(
				react.Fragment,
				null,
				h(
					"div",
					{
						className: "dcm-row",
						style: { paddingLeft: `${6 + depth * 12}px` },
						"data-active": String(!entry.dir && activePath === entry.path),
						title: entry.path,
						onClick: () => (entry.dir ? onToggle(entry.path) : onOpen(entry)),
					},
					h("span", { className: "dcm-caret" }, entry.dir ? (isOpen ? "▾" : "▸") : ""),
					h("span", { className: "dcm-name", style: { opacity: entry.dir ? 0.9 : 0.82 } }, entry.name),
					mark ? h("span", { className: "dcm-badge", "data-kind": mark }, mark) : null,
					entry.dir ? null : h("span", { className: "dcm-caret", style: { opacity: 0.3 } }, humanSize(entry.size)),
				),
				entry.dir && isOpen
					? children === undefined
						? h("div", { className: "dcm-note", style: { paddingLeft: `${20 + depth * 12}px` } }, "载入中…")
						: children.map((child) =>
								h(TreeRow, {
									key: child.path,
									entry: child,
									depth: depth + 1,
									expanded,
									cache,
									onToggle,
									onOpen,
									activePath,
									statuses,
									dirtyDirs,
								}),
							)
					: null,
			);
		}

		/** Render the source with a line-number gutter; huge files fall back to a capped view. */
		function CodeView(props) {
			const { text } = props;
			const lines = useMemo(() => text.split("\n"), [text]);
			const capped = lines.length > 4000;
			const shown = capped ? lines.slice(0, 4000) : lines;
			const numbers = useMemo(() => shown.map((_, index) => index + 1).join("\n"), [shown]);
			return h(
				"div",
				{ className: "dcm-code" },
				h("div", { className: "dcm-gutter" }, numbers),
				h("pre", { className: "dcm-source" }, shown.join("\n")),
				capped ? h("div", { className: "dcm-note" }, `仅显示前 4000 行（共 ${lines.length} 行）`) : null,
			);
		}

		/** localStorage key remembering the workspace the user last opened. */
		const ROOT_KEY = "dcm:root";

		/**
		 * The workbench panel: file tree plus tabs.
		 * @param props - standard panel props; `useWorkspaces` supplies the candidates.
		 */
		function CodingPanel(props) {
			const useWorkspaces = props.useWorkspaces;

			/**
			 * Every workspace the host knows about. A main panel receives no Session
			 * binding, so nothing here says which workspace the open conversation
			 * belongs to: the tree follows an explicit choice and only falls back to
			 * the first row until the user makes one.
			 */
			const workspaces = useWorkspaces((snapshot) => (snapshot && snapshot.items) || []);

			/** The remembered choice; empty means "not chosen yet". */
			const [picked, setPicked] = useState(() => {
				try {
					return window.localStorage.getItem(ROOT_KEY) || "";
				} catch {
					return "";
				}
			});

			/** Resolved root: the remembered choice, else the first workspace. */
			const root = useMemo(() => {
				if (picked) return picked;
				const first = workspaces[0];
				return first && typeof first.path === "string" ? first.path : "";
			}, [picked, workspaces]);

			/** Persist the choice so the next visit opens the same tree. */
			const chooseRoot = useCallback((path) => {
				setPicked(path);
				try {
					window.localStorage.setItem(ROOT_KEY, path);
				} catch {
					/* private mode: the choice simply does not persist */
				}
			}, []);
			const [cache, setCache] = useState(() => new Map());
			const [expanded, setExpanded] = useState(() => new Set());
			const [tabs, setTabs] = useState([]);
			const [active, setActive] = useState(null);
			const [editing, setEditing] = useState(false);
			const [draft, setDraft] = useState("");
			const [status, setStatus] = useState("");
			const [error, setError] = useState("");
			const inFlight = useRef(new Set());

			/** Measured host width: the dock tab is narrow, the main panel is wide, and both share this component. */
			const hostRef = useRef(null);
			const [width, setWidth] = useState(0);
			/** Whether the tree is showing. In a narrow host it becomes an overlay the user toggles. */
			const [treeOpen, setTreeOpen] = useState(true);
			/** Open right-click menu over a selection: `{ x, y, text, start, end }`, or null. */
			const [menu, setMenu] = useState(null);
			/** Active colour scheme, mirrored from `<body>` so highlighting follows the theme. */
			const [scheme, setScheme] = useState(currentScheme);
			/** Workspace search: query text, results, and whether a request is in flight. */
			const [query, setQuery] = useState("");
			const [hits, setHits] = useState(null);
			const [searchMeta, setSearchMeta] = useState(null);
			const [searching, setSearching] = useState(false);
			/** Line to reveal after a search hit opens; cleared once the target has rendered. */
			const [pendingLine, setPendingLine] = useState(null);
			/** Working-tree status: `{ available, branch, statuses }`, or null before the first read. */
			const [git, setGit] = useState(null);
			/** Bumped to force a status re-read (after a save, or a click on the branch label). */
			const [gitTick, setGitTick] = useState(0);
			/** The scroll container, so a hit can be brought into view. */
			const bodyRef = useRef(null);

			useEffect(() => {
				const node = hostRef.current;
				if (!node || typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver((entries) => {
					const box = entries[0];
					if (box) setWidth(box.contentRect.width);
				});
				observer.observe(node);
				return () => observer.disconnect();
			}, []);

			/** Follow the page's colour scheme without depending on the theme service. */
			useEffect(() => {
				if (typeof MutationObserver === "undefined" || !document.body) return;
				const observer = new MutationObserver(() => setScheme(currentScheme()));
				observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
				return () => observer.disconnect();
			}, []);

			/** Below this the tree would leave the editor unusably narrow. */
			const narrow = width > 0 && width < 620;

			useEffect(() => {
				ensureStyle();
			}, []);

			/** Load one directory into the cache, skipping concurrent duplicates. */
			const loadDir = useCallback(
				async (target) => {
					if (!root) return;
					const key = target === "" ? "" : target;
					if (inFlight.current.has(key)) return;
					inFlight.current.add(key);
					try {
						const listing = await fetchTree(root, key);
						setCache((previous) => {
							const next = new Map(previous);
							next.set(key, listing.entries);
							return next;
						});
					} catch (cause) {
						setError(String(cause && cause.message ? cause.message : cause));
						setCache((previous) => {
							const next = new Map(previous);
							next.set(key, []);
							return next;
						});
					} finally {
						inFlight.current.delete(key);
					}
				},
				[root],
			);

			/** Load the root listing whenever the root changes. */
			useEffect(() => {
				if (!root) return;
				setCache(new Map());
				setExpanded(new Set());
				setTabs([]);
				setActive(null);
				setError("");
				loadDir("");
			}, [root, loadDir]);

			/** Expand or collapse one directory, loading it on first open. */
			const toggleDir = useCallback(
				(path) => {
					setExpanded((previous) => {
						const next = new Set(previous);
						if (next.has(path)) next.delete(path);
						else next.add(path);
						return next;
					});
					if (!cache.has(path)) loadDir(path);
				},
				[cache, loadDir],
			);

			/** Open a file into a tab, reusing an existing one. */
			const openFile = useCallback(
				async (entry) => {
					setError("");
					setStatus("");
					setActive(entry.path);
					setEditing(false);
					if (tabs.some((tab) => tab.path === entry.path)) return;
					const placeholder = { path: entry.path, name: entry.name, loading: true, content: "", truncated: false, binary: false };
					setTabs((previous) => [...previous, placeholder]);
					try {
						const file = await fetchFile(root, entry.path);
						setTabs((previous) =>
							previous.map((tab) =>
								tab.path === entry.path
									? { path: entry.path, name: entry.name, loading: false, content: file.content, truncated: file.truncated, binary: file.binary }
									: tab,
							),
						);
					} catch (cause) {
						setTabs((previous) =>
							previous.map((tab) => (tab.path === entry.path ? { ...tab, loading: false, error: String(cause && cause.message ? cause.message : cause) } : tab)),
						);
					}
				},
				[root, tabs],
			);

			/** Close one tab and re-target the active one when needed. */
			const closeTab = useCallback(
				(path) => {
					setTabs((previous) => {
						const next = previous.filter((tab) => tab.path !== path);
						setActive((current) => {
							if (current !== path) return current;
							const fallback = next[next.length - 1];
							return fallback ? fallback.path : null;
						});
						return next;
					});
				},
				[],
			);

			/** Save the active tab's draft. */
			const save = useCallback(async () => {
				const tab = tabs.find((item) => item.path === active);
				if (!tab) return;
				setStatus("保存中…");
				try {
					await putFile(root, tab.path, draft);
					setTabs((previous) => previous.map((item) => (item.path === tab.path ? { ...item, content: draft } : item)));
					setEditing(false);
					setStatus("已保存");
					setGitTick((tick) => tick + 1);
				} catch (cause) {
					setError(String(cause && cause.message ? cause.message : cause));
					setStatus("");
				}
			}, [tabs, active, draft, root]);

			/** BEGIN EDIT switches the active tab into a textarea seeded with its content. */
			const beginEdit = useCallback(() => {
				const tab = tabs.find((item) => item.path === active);
				if (!tab) return;
				setDraft(tab.content);
				setEditing(true);
				setStatus("");
			}, [tabs, active]);

			/** Ctrl/Cmd+S saves while editing, matching the editor muscle memory. */
			useEffect(() => {
				if (!editing) return;
				const onKey = (event) => {
					if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
						event.preventDefault();
						save();
					}
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [editing, save]);

			/**
			 * Read whatever is selected under the pointer, from the textarea while
			 * editing or from the rendered source otherwise.
			 * @returns `{ text, start, end }`, or null when the selection is empty.
			 */
			const readSelection = useCallback((event) => {
				const node = event.target;
				if (node && node.tagName === "TEXTAREA") {
					const value = node.value;
					const from = node.selectionStart;
					const to = node.selectionEnd;
					if (from === to) return null;
					const text = value.slice(from, to);
					if (!text.trim()) return null;
					const start = value.slice(0, from).split("\n").length;
					const end = Math.max(start, value.slice(0, to).split("\n").length - (text.endsWith("\n") ? 1 : 0));
					return { text, start, end };
				}
				const selection = window.getSelection();
				if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
				const text = selection.toString();
				if (!text.trim()) return null;
				const span = lineRangeOf(selection.getRangeAt(0), event.currentTarget.querySelector("pre"));
				return { text, start: span.start, end: span.end };
			}, []);

			/** Dismiss the menu on any outside press, Escape, or scroll. */
			useEffect(() => {
				if (!menu) return;
				const close = () => setMenu(null);
				const onKey = (event) => {
					if (event.key === "Escape") close();
				};
				window.addEventListener("mousedown", close);
				window.addEventListener("keydown", onKey);
				window.addEventListener("scroll", close, true);
				return () => {
					window.removeEventListener("mousedown", close);
					window.removeEventListener("keydown", onKey);
					window.removeEventListener("scroll", close, true);
				};
			}, [menu]);

			/**
			 * Keep the active tab's highlighted markup in step with the colour scheme.
			 * The per-tab stamp stops it from refetching the same file/scheme pair, and
			 * a failed fetch still stamps it so the effect cannot spin.
			 */
			useEffect(() => {
				const tab = tabs.find((item) => item.path === active);
				if (!tab || tab.loading || tab.error || tab.binary || tab.truncated || !tab.content) return;
				if (tab.highlightScheme === scheme) return;
				let live = true;
				fetchHighlight(root, tab.path, scheme)
					.then((result) => {
						if (!live) return;
						setTabs((previous) =>
							previous.map((item) =>
								item.path === tab.path
									? { ...item, html: result && result.html ? result.html : null, highlightScheme: scheme }
									: item,
							),
						);
					})
					.catch(() => {
						if (!live) return;
						setTabs((previous) =>
							previous.map((item) => (item.path === tab.path ? { ...item, highlightScheme: scheme } : item)),
						);
					});
				return () => {
					live = false;
				};
			}, [tabs, active, root, scheme]);

			/** Debounced workspace search; a cleared query returns to the file tree. */
			useEffect(() => {
				const needle = query.trim();
				if (!needle) {
					setHits(null);
					setSearchMeta(null);
					setSearching(false);
					return;
				}
				let live = true;
				setSearching(true);
				const timer = setTimeout(() => {
					fetchSearch(root, needle)
						.then((result) => {
							if (!live) return;
							setHits(result.results || []);
							setSearchMeta(result);
						})
						.catch(() => {
							if (live) setHits([]);
						})
						.finally(() => {
							if (live) setSearching(false);
						});
				}, 280);
				return () => {
					live = false;
					clearTimeout(timer);
				};
			}, [query, root]);

			/** Track working-tree status; re-read on root change, window focus, and explicit ticks. */
			useEffect(() => {
				if (!root) {
					setGit(null);
					return;
				}
				let live = true;
				const load = () => {
					fetchGit(root)
						.then((result) => {
							if (live) setGit(result);
						})
						.catch(() => {
							if (live) setGit(null);
						});
				};
				load();
				window.addEventListener("focus", load);
				return () => {
					live = false;
					window.removeEventListener("focus", load);
				};
			}, [root, gitTick]);

			/** Directory paths whose subtree holds a changed file, for the aggregate marker. */
			const dirtyDirs = useMemo(() => {
				const dirs = new Set();
				const statuses = (git && git.available && git.statuses) || {};
				for (const path of Object.keys(statuses)) {
					let cut = path.lastIndexOf("/");
					while (cut > 0) {
						const dir = path.slice(0, cut);
						if (dirs.has(dir)) break;
						dirs.add(dir);
						cut = dir.lastIndexOf("/");
					}
				}
				return dirs;
			}, [git]);

			/** Scroll the body to a 1-based line, preferring shiki's per-line spans. */
			const revealLine = useCallback((line) => {
				const host = bodyRef.current;
				if (!host) return;
				const span = host.querySelectorAll(".dcm-hl .line")[line - 1];
				if (span) {
					span.scrollIntoView({ block: "center" });
					return;
				}
				const pre = host.querySelector("pre.dcm-source");
				if (!pre) return;
				const size = Number.parseFloat(window.getComputedStyle(pre).lineHeight) || 18;
				host.scrollTop = Math.max(0, (line - 1) * size - host.clientHeight / 2);
			}, []);

			/** Open a search hit and remember which line to reveal once it renders. */
			const openHit = useCallback(
				(hit) => {
					setPendingLine(hit.line);
					openFile({ path: hit.path, name: hit.path.split("/").pop() || hit.path, dir: false });
				},
				[openFile],
			);

			/** Reveal the pending line once the tab's final markup — plain or highlighted — is in place. */
			useEffect(() => {
				if (pendingLine === null) return;
				const tab = tabs.find((item) => item.path === active);
				if (!tab || tab.loading || !tab.content) return;
				if (tab.binary || tab.truncated) {
					setPendingLine(null);
					return;
				}
				if (!tab.html && tab.highlightScheme !== scheme) return;
				const timer = setTimeout(() => {
					revealLine(pendingLine);
					setPendingLine(null);
				}, 0);
				return () => clearTimeout(timer);
			}, [pendingLine, tabs, active, scheme, revealLine]);

			const rows = cache.get("");
			const activeTab = tabs.find((tab) => tab.path === active) || null;

			/**
			 * Workspace switcher. A main panel carries no Session binding, so the
			 * tree cannot infer what the open conversation is working on; the picker
			 * makes that choice explicit and remembers it.
			 */
			const knownRoot = workspaces.some((workspace) => workspace.path === root);
			const workspacePicker =
				workspaces.length > 0
					? h(
							"select",
							{
								className: "dcm-select",
								value: root,
								title: root,
								onChange: (event) => chooseRoot(event.target.value),
							},
							knownRoot || !root
								? null
								: h("option", { key: "__stale", value: root }, root),
							workspaces.map((workspace) =>
								h(
									"option",
									{ key: workspace.workspaceId, value: workspace.path },
									workspace.title || workspace.path,
								),
							),
						)
					: null;

			/** File tree rows, or the empty/loading state for the current root. */
			const treeRows = !root
				? h("div", { className: "dcm-empty" }, "还没有工作区。先在左侧新建或打开一个工作区。")
				: rows === undefined
					? h("div", { className: "dcm-note" }, "载入中…")
					: rows.length === 0
						? h("div", { className: "dcm-empty" }, "这个目录是空的。")
						: rows.map((entry) =>
								h(TreeRow, {
									key: entry.path,
									entry,
									depth: 0,
									expanded,
									cache,
									onToggle: toggleDir,
									onOpen: openFile,
									activePath: active,
									statuses: git && git.available ? git.statuses : null,
									dirtyDirs,
								}),
							);

			/** Search results, replacing the tree while a query is present. */
			const searchView = searching
				? h("div", { className: "dcm-note" }, "搜索中…")
				: hits === null
					? null
					: hits.length === 0
						? h("div", { className: "dcm-empty" }, "没有匹配。")
						: h(
								react.Fragment,
								null,
								h(
									"div",
									{ className: "dcm-meta" },
									searchMeta && searchMeta.truncated
										? `已截断：前 ${hits.length} 条`
										: `${hits.length} 条匹配`,
								),
								hits.map((hit) =>
									h(
										"div",
										{
											key: `${hit.path}:${hit.line}`,
											className: "dcm-hit",
											title: `${hit.path}:${hit.line}`,
											onClick: () => openHit(hit),
										},
										h("div", { className: "dcm-hit-path" }, `${hit.path}:${hit.line}`),
										h("div", { className: "dcm-hit-text" }, hit.text || " "),
									),
								),
							);

			const treeColumn = h(
				"div",
				{ className: narrow ? "dcm-tree dcm-overlay" : "dcm-tree" },
				h(
					"div",
					{ className: "dcm-tree-head" },
					h("span", { className: "dcm-tree-label" }, "文件"),
					workspacePicker,
					git && git.available && git.branch
						? h(
								"span",
								{
									className: "dcm-branch",
									title: "点击刷新 Git 状态",
									onClick: () => setGitTick((tick) => tick + 1),
								},
								git.branch,
							)
						: null,
				),
				h(
					"div",
					{ className: "dcm-search" },
					h("input", {
						className: "dcm-input",
						type: "search",
						placeholder: "搜索工作区…",
						value: query,
						onChange: (event) => setQuery(event.target.value),
						onKeyDown: (event) => {
							if (event.key === "Escape") setQuery("");
						},
					}),
				),
				h("div", { className: "dcm-tree-body" }, query.trim() ? searchView : treeRows),
			);

			const tabStrip = h(
				"div",
				{ className: "dcm-tabs" },
				tabs.map((tab) =>
					h(
						"div",
						{
							key: tab.path,
							className: "dcm-tab",
							"data-active": String(tab.path === active),
							title: tab.path,
							onClick: () => {
								setActive(tab.path);
								setEditing(false);
								setStatus("");
							},
						},
						h("span", null, glyph(tab.name, false)),
						h("span", { className: "dcm-tab-label" }, tab.name),
						h(
							"span",
							{
								className: "dcm-tab-x",
								onClick: (event) => {
									event.stopPropagation();
									closeTab(tab.path);
								},
							},
							"×",
						),
					),
				),
				h(
					"div",
					{ className: "dcm-actions" },
					narrow
						? h(
								"button",
								{ className: "dcm-btn", onClick: () => setTreeOpen((open) => !open) },
								treeOpen ? "收起文件" : "文件",
							)
						: null,
					activeTab && !activeTab.loading
						? editing
							? h(
									react.Fragment,
									null,
									h("button", { className: "dcm-btn", onClick: save }, "保存 ⌘S"),
									h("button", { className: "dcm-btn", onClick: () => { setEditing(false); setStatus(""); } }, "取消"),
								)
							: h("button", { className: "dcm-btn", onClick: beginEdit, disabled: activeTab.binary }, "编辑")
						: null,
				),
			);

			const body = !activeTab
				? h("div", { className: "dcm-note" }, "从左侧选一个文件。")
				: activeTab.loading
					? h("div", { className: "dcm-note" }, "载入中…")
					: activeTab.error
						? h("div", { className: "dcm-note dcm-err" }, activeTab.error)
						: activeTab.binary
							? h("div", { className: "dcm-note" }, "二进制文件，无法以文本显示。")
							: editing
								? h("textarea", {
										className: "dcm-editor",
										value: draft,
										spellCheck: false,
										onChange: (event) => setDraft(event.target.value),
									})
								: activeTab.html && activeTab.highlightScheme === scheme
									? h("div", { className: "dcm-hl", dangerouslySetInnerHTML: { __html: activeTab.html } })
									: h(CodeView, { text: activeTab.content });

			const banner = [],
				push = (value) => banner.push(value);
			if (error) push(h("div", { className: "dcm-strip dcm-err" }, error));
			if (status) push(h("div", { className: "dcm-strip" }, status));
			if (activeTab && activeTab.truncated) push(h("div", { className: "dcm-strip" }, "文件较大，只读取了前 2MB。"));

			/**
			 * Build what the chat input receives: a `path:lines` locator, then a fenced
			 * block whose tag matches the file extension.
			 */
			const snippetFor = (entry) => {
				const tab = tabs.find((item) => item.path === active);
				const where = tab ? tab.path : "";
				const span = entry.end > entry.start ? `${entry.start}-${entry.end}` : `${entry.start}`;
				const fence = languageOf(where);
				const source = entry.text.replace(/\n$/, "");
				return `${where}:${span}\n\`\`\`${fence}\n${source}\n\`\`\`\n`;
			};

			const menuNode = menu
				? h(
						"div",
						{
							className: "dcm-menu",
							style: { left: `${menu.x}px`, top: `${menu.y}px` },
							onMouseDown: (event) => event.stopPropagation(),
						},
						h(
							"button",
							{
								className: "dcm-menu-item",
								onClick: () => {
									props.onInsertToChat(snippetFor(menu));
									setMenu(null);
								},
							},
							`添加到对话（${menu.end - menu.start + 1} 行）`,
						),
					)
				: null;

			return h(
				"div",
				{ className: "dcm-root", ref: hostRef },
				!narrow || treeOpen ? treeColumn : null,
				h(
					"div",
					{ className: "dcm-main" },
					tabStrip,
					banner,
					h(
						"div",
						{
							className: "dcm-body",
							ref: bodyRef,
							onContextMenu: (event) => {
								if (typeof props.onInsertToChat !== "function") return;
								const picked = readSelection(event);
								if (!picked) return;
								event.preventDefault();
								setMenu({ ...picked, x: event.clientX, y: event.clientY });
							},
						},
						body,
					),
				),
				menuNode,
			);
		}

		/** Implementation identity for the right-dock tab type; the body slots key off it. */
		const DOCK_ID = "coding-mode-dock";
		/** What `ctx.sidebarRight.openTab` names for this type. */
		const DOCK_KIND = "coding";

		/**
		 * Dock body: the workbench inside the right column, so the conversation keeps
		 * the centre and both are visible at once. The dock tab is Session scoped and
		 * receives `sessionId`, but the workbench reads files by workspace root, so it
		 * ignores that binding.
		 */
		function WorkbenchDock(props) {
			/**
			 * Insert a snippet into this Session's chat input at the caret, as one undo
			 * step. `insertText` is revision guarded: it returns false instead of
			 * clobbering edits made while the request was in flight.
			 */
			const actions = props.inputActions;
			const insert = useMemo(() => {
				if (!actions || typeof actions.captureInsertion !== "function") return undefined;
				return (block) => {
					try {
						actions.insertText(block, actions.captureInsertion());
					} catch {
						/* the draft is locked while a submission is in flight */
					}
				};
			}, [actions]);
			return h(CodingPanel, { useWorkspaces: props.useWorkspaces, onInsertToChat: insert });
		}

		/** Conversation header button that opens the dock tab. */
		function OpenDockButton(props) {
			return h(
				"button",
				{ className: "dcm-btn", onClick: () => props.openDock(), title: "在右栏打开编辑器" },
				"编辑器",
			);
		}

		/**
		 * Services this browser plugin needs. The slot registry is required; the dock
		 * services are looked up in `apply`, so a profile without the right Sidebar
		 * registers nothing rather than failing to activate.
		 */
		const inject = ["slots"];

		/**
		 * Client plugin body: register the dock tab type and the two seats it needs —
		 * its body, and the conversation header button that opens it.
		 * @param ctx - client root context carrying `slots`.
		 */
		function apply(ctx) {
			ctx.inject(["sidebarRight", "sidebarRightTabs"], (dockCtx) => {
				/** Open (or reveal) the workbench tab in the right dock. */
				const openDock = () => {
					try {
						dockCtx.sidebarRight.openTab(DOCK_KIND);
					} catch {
						/* no Session selected: the dock has nothing to open into yet */
					}
				};

				dockCtx.effect(
					() =>
						dockCtx.sidebarRightTabs.register({
							id: DOCK_ID,
							kind: DOCK_KIND,
							priority: "extension",
							title: () => "编辑器",
						}),
					"coding-mode: dock tab type",
				);
				dockCtx.slots.inject("sidebar.right.pane.tab", () =>
					dockCtx.slots.register({ name: "sidebar.right.pane.tab", key: DOCK_ID }, WorkbenchDock),
				);
				dockCtx.slots.inject("sidebar.right.pane.tab.title", () =>
					dockCtx.slots.register({ name: "sidebar.right.pane.tab.title", key: DOCK_ID }, () => "编辑器"),
				);
				dockCtx.slots.inject("conversation.session.header.utilities", () =>
					dockCtx.slots.register(
						{
							name: "conversation.session.header.utilities",
							id: "coding-mode-dock",
							order: 30,
							label: () => "编辑器",
							inject: () => ({ openDock }),
						},
						OpenDockButton,
					),
				);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});

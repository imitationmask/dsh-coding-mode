# TODO

`@local/dsh-coding-mode` —— DeepSeek Harness Web 的 VS Code 式工作台插件。
本文件记录现状、待办与运维要点，供后续会话接手。

最后更新：2026-11-01

---

## 现状

一个原生 DSH 客户端插件，不改任何官方包，走 rc.5 的槽位契约：

| 部分 | 位置 | 作用 |
|---|---|---|
| 宿主半侧 | [`lib/index.js`](lib/index.js) | `/coding-mode` 下的目录列举、读文件、写文件；强制路径不越出 `root` |
| 客户端半侧 | [`lib/client.js`](lib/client.js) | 手写 loader 工厂格式，无需构建；只从平台表 require `react` |

- 标签页类型：`ctx.sidebarRightTabs.register({ id: "coding-mode-dock", kind: "coding" })`
- 主体与标题：`sidebar.right.pane.tab` / `sidebar.right.pane.tab.title`（key = `coding-mode-dock`）
- 入口：`conversation.session.header.utilities` 的一个按钮，调 `ctx.sidebarRight.openTab("coding")`
- 包装：`dsh.bundle.patch` 指向内置 `cordis.patch.yml`，由该层插入插件行——安装只需
  「装依赖 + 把包名加进 `dsh.profile.bundles`」，不必手写 profile patch
- 接线：profile 的 `package.json` 一个 `link:` 依赖；插件目录经符号链接进
  `~/.dsh/profiles/web/node_modules/@local/`
- 可移植：零 npm 依赖、代码内无绝对路径，换机器步骤见 [`README.md`](README.md)

已实现：工作区下拉切换（记住选择）、懒加载文件树、多标签复用与关闭、行号视图、
编辑模式 + `⌘S` 保存、语法高亮（跟随深浅色）、全局搜索（跳转定位）、
Git 状态角标（含目录聚合与分支名）、选中内容右键「添加到对话」、
2MB 读取上限、4000 行渲染上限、路径越界拒绝。

**「添加到对话」的实现**：dock tab 的标准 props 里带 `inputActions`，用
`captureInsertion()` 取带版本的选择游标、`insertText(text, span)` 一次插入（单步撤销，
版本不符时拒绝而不是覆盖）。插入内容是 `路径:起始-结束行` + 对应语言的围栏代码块；
查看模式和编辑模式（textarea 的 `selectionStart/End`）都支持。

**为什么有工作区下拉框**：`main` 面板按布局契约不绑定会话（只有保留的 `conversation`
键才有会话绑定），所以面板拿不到「当前对话属于哪个工作区」。`useWorkspaces()` 只给出
全部工作区列表，因此根目录只能显式选择。

---

## 待办

### 1. 语法高亮 —— 已实现（2026-11-01）

**做法**：宿主侧用 shiki 出高亮 HTML，客户端只负责插入。

- 入口：`GET /coding-mode/highlight?root=&path=&theme=light|dark`
- 色板：`github-light` / `github-dark` 成对，切换主题只换请求参数
- 语言按扩展名映射（`LANGUAGES` 表），未知扩展名走 `text`
- 语法按需加载并缓存（`loadedLanguages`），单例 highlighter 懒初始化
- 行号用 CSS 计数器挂在 shiki 的 `.line` 上，不额外渲染 gutter

**主题跟随**：客户端不注入 theme 服务，而是监听 `<body data-ds-dark-theme>` 的
属性变化（`MutationObserver`）——这个属性本就是主题 presenter 的公开投影点，
少一条服务依赖，也不会因为快照结构变化而断。

**限额与回退**
- 文件 > 512KB 不送高亮，接口回 `tooLarge`，客户端退回纯文本视图
- 含 NUL 的二进制回 `binary`，不渲染
- 高亮失败只影响着色，正文仍然可读（同一份内容走两条路径取）

**为什么没做客户端高亮**：前端引一套高亮器要打进手写的 bundle，等于自建构建链；
宿主侧 shiki 只在请求时跑，改主题也只是再发一次请求。

---

### 2. 全局搜索 —— 已实现（2026-11-01）

**做法**：宿主侧递归遍历出 `文件:行号:内容`，客户端在文件树上方放搜索框，结果替换树列表。

- 入口：`GET /coding-mode/search?root=&q=&limit=`（limit 默认 200，上限 500）
- 遍历：跳过与文件树相同的隐藏目录；目录优先排序，结果是稳定的
- 上限：单文件 512KB、扫描 20000 个文件、单次 5 秒墙钟，任一触发即回 `truncated`
- 客户端：280ms 防抖；结果点击复用 `openFile()`，再按目标行滚动定位

**定位实现**：`revealLine()` 优先用 shiki 的 `.line` 节点 `scrollIntoView`；纯文本回退
按 `lineHeight × 行号` 估算 `scrollTop`。滚动时机由 `pendingLine` effect 控制，
只在「已拿到高亮 HTML」或「高亮已尝试但无结果」时执行，避免高亮到达后把滚动位置冲掉。

**限制**
- 逐文件 `readFile` 全量载入，不流式；大文件直接被 512KB 上限挡掉
- 大小写不敏感；没有正则、整词、包含/排除规则
- 结果不持久化，清空输入即回到文件树

---

### 3. Git 状态角标 —— 已实现（2026-11-01）

**做法**：宿主侧跑 `git status --porcelain=v1 -z --branch --untracked-files=all`，
客户端把结果挂到树节点上。

- 入口：`GET /coding-mode/git?root=`；非仓库回 `{ available: false, reason }`（200，不是错误）
- 状态映射：`??` → `U`（未跟踪）、`M/A/D/R/C` 原样、冲突（含 `U` 的成对码）→ `!`
- 重命名：`-z` 模式下新路径在前、原路径是下一个 NUL 字段，解析时跳过后者
- 目录聚合：预先把每个改动路径的所有祖先目录收进 `Set`，树里用 `●` 标记
- 刷新：切换工作区、窗口获得焦点、保存文件后各触发一次；点分支名可手动刷新
- 分支名显示在文件树标题栏右侧

**为什么不用 `fs.watch`**：工作区可能是大仓库，常驻 watch 的开销与误报都不划算；
聚焦时重读一次已经够用，保存后主动补一次。

**限制**
- 只读状态，不能 stage / commit
- 依赖本机 `git` 可执行文件；没有时回 `git-not-installed`
- 状态按相对路径精确匹配，子模块内部的改动不展开

---

### 4. 对话并排 —— 已实现（2026-11-01）

**做法**：对话留在中央 `main`，工作台另外注册成一个右栏 dock tab（kind `coding`），
从对话页头的「编辑器」按钮打开。右栏可拖到视口宽度的 70%（默认 45%），足够放
「文件树 + 编辑器」。

- 类型注册：`ctx.sidebarRightTabs.register({ id: 'coding-mode-dock', kind: 'coding', priority: 'extension' })`
- 主体：`sidebar.right.pane.tab`（key = `coding-mode-dock`）；标题：`sidebar.right.pane.tab.title`
- 入口：`conversation.session.header.utilities` 里一个按钮，调 `ctx.sidebarRight.openTab('coding')`
- 窄栏自适应：容器宽度 < 620px 时文件树变成可切换浮层，把宽度让给编辑器

> 2026-11-01 后续决定：**主面板与侧栏图标已移除**，只保留右栏 dock 一个入口。
> 理由是主面板与 dock 各持一份独立实例，维护两套入口的收益不抵复杂度；
> 代价是没有全宽编辑器，右栏最宽 70%。

**为什么不是「把对话嵌进编辑器」**：对话包没有对外导出的 React 组件（只导出
controller / registry），而 `main` 是 keyed 槽，一次只能挂一个面板。自渲染对话等于重写
消息流、工具卡片、输入框与审批流程，成本远超收益。dock tab 复用同一份工作台组件，
代价是宽度受右栏上限约束。

**已知取舍**
- 右栏最宽 70%，没有全宽编辑器；需要更宽就把分隔条拖到 70%
- 关闭标签页后，用对话页头的「编辑器」按钮重新打开

---

## 已知限制

| 限制 | 说明 |
|---|---|
| 改 `lib/client.js` 需重启 `dsh web` | `hmr` 的 `root: []` 不监听模块，客户端 bundle 只在扫描时快照 |
| 高亮上限 512KB | 超过则退回纯文本（`MAX_HIGHLIGHT_BYTES`） |
| 只读上限 2MB / 渲染 4000 行 | `lib/index.js` 的 `MAX_READ_BYTES`、`lib/client.js` 的 `CodeView` |
| 根目录需手选 | 面板无会话绑定，见上文 |

**绕开「必须重启」的试验**：把插件目录加进 profile patch 的 `hmr.config.root`，
观察改动 `lib/client.js` 后能否经 `rebuilt()` 进入模块图。若可行，以后改完刷新页面即可。
临时办法是把 `dsh.profile.bundles` 里的包名暂时移除再加回，强制重新扫描（已验证有效）。

---

## 运维

**改动生效**
- 宿主半侧（`lib/index.js`）：profile 配置热更会重新挂载，一般无需重启。
- 客户端半侧（`lib/client.js`）：同上需强制重扫，或重启 `dsh web`；然后强刷页面。

**回滚**
1. 从 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 删掉 `@local/dsh-coding-mode`
2. 删掉同文件 `dependencies` 里的 `@local/dsh-coding-mode`
3. 删掉 `~/.dsh/profiles/web/node_modules/@local/dsh-coding-mode` 符号链接

**自测**
```bash
ROOT=/Users/qinghuatong/Documents/deepseek-harness/default-workspace
curl -sS "http://127.0.0.1:3080/coding-mode/tree?root=$ROOT&path="
curl -sS "http://127.0.0.1:3080/coding-mode/file?root=$ROOT&path=README.md"
curl -sS "http://127.0.0.1:3080/coding-mode/tree?root=$ROOT&path=../../etc"   # 应 400 outside-root
```

---

## 关键 API 速查

- 槽位契约：`main` 是 keyed 槽（`{ name, key }`），`sidebar.panellist` 里 `id` 必须等于面板 key；
  面板组件可拿到 `useWorkspaces` / `useSessions` / `usePanelInfo` 等标准 props。
- 宿主路由：`ctx.inject(['webServer'], web => web.effect(() => web.webServer.register({ kind: 'prefix', path, handler }), label))`
- 官方文件读取（若想弃用自定义宿主接口）：`remote.workspaceFiles.list/read/stat/changes`，
  首参是会话标识，因此只能用在会话绑定的槽位里。
- 主题变量：`--dsw-alias-bg-layer-1/2/3`、`--dsw-alias-border-l3`、`--dsw-alias-brand-primary`、
  `--dsh-font-family-code`、`--dsh-code-font-size`、`--dsw-radius-sm`。
- 不需要构建：`lib/client.js` 是 `window.__ModuleLoader__.load({ id, factory })` 工厂格式，
  平台表里可直接 require `react`。

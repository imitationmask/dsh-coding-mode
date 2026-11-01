# dsh-coding-mode

DeepSeek Harness Web 的 VS Code 式工作台：**工作区文件树 + 多标签编辑器**，
以**右侧 dock 的一个标签页**打开，与中央的对话并排显示，不修改任何官方包。

- 唯一运行时依赖是 `shiki`（宿主侧出高亮）；客户端半侧是手写的 loader 工厂格式，无需构建
- 宿主半侧提供受限的文件读写接口，路径强制不出工作区
- 工作区可切换并记住选择；文件可查看、编辑、`⌘S` 保存
- 语法高亮：`github-light` / `github-dark` 双色板，跟随界面深浅色自动切换
- 全局搜索：文件树上方搜索框，结果为 `文件:行号:内容`，点击跳转并定位到行
- Git 状态角标：`M/U/A/D/R` 标在文件上，目录用 `●` 聚合，标题栏显示分支名
- 选中代码右键「添加到对话」：把选区连同 `路径:行号` 与代码块插入当前会话输入框
- 右栏可拖宽至视口 70%；栏宽 < 620px 时文件树自动收成浮层

## 环境要求

- DeepSeek Harness **0.2.1-rc.5**（开发与验证所用版本）
- `web` 或 `desktop` 这类带浏览器界面的 profile（依赖 `webServer` 服务）

> 插件用的是 rc.5 的槽位契约（`main` keyed 槽、`sidebar.panellist`、面板标准 props）。
> 跨大版本升级时这些签名可能变化，升级后请先确认面板仍能渲染。

## 安装

包本身是一个 **bundle**：`dsh.bundle.patch` 指向内置的 [`cordis.patch.yml`](cordis.patch.yml)，
安装后由该 patch 层插入插件行。因此安装 = **装依赖 + 选上这个 bundle**。

### 方式 A：从本地目录安装（推荐）

```bash
# 1. 把整个目录拷到新机器（或 git clone），假设路径为 /path/to/dsh-coding-mode
#    再在插件目录里装一次它自己的依赖（shiki）：
#    pnpm install   # 或 npm install
#    link: 安装只建符号链接，不会替被链接的包装依赖

# 2. 装进目标 profile 的依赖
dsh plugin --profile web add link:/path/to/dsh-coding-mode

# 3. 在 ~/.dsh/profiles/web/package.json 的 dsh.profile.bundles 里加上包名
#    "@local/dsh-coding-mode"
#
# 4. 重启 dsh web，刷新页面
```

`package.json` 第 3 步应该长这样：

```json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "@local/dsh-coding-mode"
    ]
  }
}
```

### 方式 B：打成 tarball 带走

```bash
# 在源机器
npm pack                       # 产出 local-dsh-coding-mode-0.1.0.tgz

# 在目标机器
dsh plugin --profile web add ./local-dsh-coding-mode-0.1.0.tgz
# 然后同样把包名加进 dsh.profile.bundles
```

### 方式 C：插件页安装

Web 的「插件 → 已安装 → 安装」会调用 `installBundle`，一步完成「装依赖 + 选上 bundle」。
填入本地路径或 tarball 路径即可，省掉手动改 `bundles` 的第 3 步。

## 验收

重启后打开 `http://127.0.0.1:3080`，对话右上角的会话工具区出现「编辑器」按钮；
点它右栏打开工作台（文件树 + 标签页），标题栏有工作区下拉框，分隔条可往左拖加宽。
也可以直接打接口：

```bash
ROOT=/你的/工作区路径
curl -sS "http://127.0.0.1:3080/coding-mode/tree?root=$ROOT&path="
curl -sS "http://127.0.0.1:3080/coding-mode/tree?root=$ROOT&path=../../etc"   # 应 400 outside-root
```

## 卸载

1. 从 `dsh.profile.bundles` 里删掉 `@local/dsh-coding-mode`
2. `dsh plugin --profile web remove @local/dsh-coding-mode`
3. 重启 `dsh web`

## 结构

| 文件 | 作用 |
|---|---|
| [`lib/index.js`](lib/index.js) | 宿主半侧：`/coding-mode` 下的目录列举、读、写、搜索、git 状态、shiki 高亮 |
| [`lib/client.js`](lib/client.js) | 客户端半侧：右栏 dock 标签页与对话页头入口 |
| [`cordis.patch.yml`](cordis.patch.yml) | bundle 的 patch 层，插入插件行 |
| [`TODO.md`](TODO.md) | 待办、已知限制、运维与 API 速查 |

## 开发提示

- 宿主半侧改动：profile 配置热更会重新挂载，通常不必重启。
- 客户端半侧改动：客户端 bundle 只在扫描时快照，**需要重启**或先停用再启用 bundle 强制重扫。
- 自测脚本思路见 [`TODO.md`](TODO.md) 的「运维」一节。

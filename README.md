# AI Tool Box

本项目主要用于集成目前市面上主流的 AI 工具，方便用户统一使用。

## 主要功能

- 集成多个主流 AI 工具（ChatGPT、DeepSeek 等）
- 统一界面操作，提升使用体验

## 实现方案

渲染层使用 **Svelte 5 + TypeScript + Vite**，桌面容器使用 Electron。
统一输入通过现有站点适配器发送到内嵌 Webview，支持对话、生图参考图、
回复收集与 LLM 汇总，以及网站、代理、定位和无痕会话设置。

- `src/components/*.svelte`：界面组件，继续使用现有 CSS Modules 与主题令牌。
- `src/hooks/*.svelte.ts`：基于 `$state` / `$derived` / `$effect` 的响应式状态。
- `src/webview-handlers`、`electron`：站点适配与桌面通信。

页面首次访问时按需加载，切换页面和网站标签时保留已打开的会话。
Markdown 使用 marked 解析，并经 DOMPurify 清理后渲染。

## 本地开发

```sh
pnpm install
pnpm dev
```

仅预览界面可运行 `pnpm dev:web`，地址为 `http://127.0.0.1:5173`。
普通浏览器不支持 Electron Webview，第三方网站内容、原生输入与桌面 IPC
需要通过 `pnpm dev` 验证。开发与正式版本继续使用各自的存储键。

## 检查与测试

```sh
pnpm type-check
pnpm lint
pnpm build
pnpm electron:compile
pnpm exec playwright install chromium
pnpm test:ui
pnpm test:electron
```

`svelte-check --tsgo` 使用 `@typescript/native` 中的 TypeScript 7。
当前检查器仍需要 TypeScript 6 的编译器 API，因此保留双版本开发依赖。

浏览器测试覆盖设置持久化、工具选择、主题、草稿保活、参考图、汇总面板和窄屏布局。
Electron 测试使用隐藏窗口、临时用户目录、真实 preload 和本地替代网站，
不访问真实 AI 服务。已有 Edge 的 Windows 环境可将 `PLAYWRIGHT_CHANNEL`
设为 `msedge` 运行浏览器测试。

### 已知运行时限制

保留的 Electron 44.4.1 在销毁 Webview 时可能报告
`Invalid guestInstanceId`。已通过不经过 Svelte 的原生 `element.remove()`
单独复现；替换后的 Webview 仍可正常加载。Electron 回归测试对该版本、
该已销毁 guest 的诊断进行明确标注，其余运行时错误仍会导致测试失败。

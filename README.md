# AI Tool Box

本项目主要用于集成目前市面上主流的 AI 工具，方便用户统一使用。

## 主要功能

- 集成多个主流 AI 工具（ChatGPT、DeepSeek 等）
- 统一界面操作，提升使用体验

## 实现方案

渲染层使用 **Svelte 5 + TypeScript + Vite**，桌面容器使用 **Tauri 2 + Rust**。
统一输入通过现有站点适配器发送到内嵌 Webview，支持对话、生图参考图、
回复收集与 LLM 汇总，以及网站、代理、定位和无痕会话设置。

- `src/components/*.svelte`：界面组件，继续使用现有 CSS Modules 与主题令牌。
- `src/hooks/*.svelte.ts`：基于 `$state` / `$derived` / `$effect` 的响应式状态。
- `src/webview-handlers`：现有站点输入、对话和回复提取脚本。
- `src/desktop`：Tauri IPC 桥接和原生子 WebView 的 DOM 锚点适配。
- `src-tauri`：窗口、WebView、会话、设置存储及 LLM 请求后端。

页面首次访问时按需加载，切换页面和网站标签时保留已打开的会话。
Markdown 使用 marked 解析，并经 DOMPurify 清理后渲染。

## 本地开发

```sh
pnpm install
pnpm dev
```

需要 Rust stable 和各平台原生构建依赖。Windows 需要 Visual Studio C++ Build
Tools 与 WebView2 Runtime；macOS 需要 Xcode Command Line Tools；Linux 需要
WebKitGTK 4.1、GTK 3、DBus/Secret Service 开发库。Linux 依赖安装示例见发布工作流。

仅预览界面可运行 `pnpm dev:web`，地址为 `http://127.0.0.1:5175`。
普通浏览器不创建第三方 iframe；网站内容与桌面 IPC 需要通过 `pnpm dev` 验证。
开发和正式版设置、网站会话及 LLM 凭据分别隔离。开发端口由 Vite 和
`src-tauri/tauri.conf.json` 同时配置，修改时须保持一致。

## 检查与测试

```sh
pnpm check
pnpm icons
pnpm test:rust
pnpm exec playwright install chromium
pnpm test
pnpm build
```

`svelte-check --tsgo` 使用 TypeScript 7，并保留 TypeScript 6 的编译器 API 依赖。
`pnpm build` 使用 Tauri 打包，安装包位于 `src-tauri/target/release/bundle`。
单独构建 Windows 安装包可使用 `pnpm build --bundles nsis`。

浏览器测试覆盖设置持久化、工具选择、主题、草稿保活、参考图、汇总面板和窄屏布局。
新增测试覆盖 WebView 显隐同步、异步创建期间卸载和实例寻址。
已有 Edge 的 Windows 环境可将 `PLAYWRIGHT_CHANNEL` 设为 `msedge`。

Windows 原生集成测试需要先启动 `pnpm dev:web`，再运行：

```sh
pnpm icons
cargo build --manifest-path src-tauri/Cargo.toml
pnpm test:native
```

原生测试启动隐藏的 Tauri 窗口，仅访问本地 fixture，使用 `.cache` 下的独立数据目录，
覆盖真实 WebView2 的异步脚本、统一输入、权限隔离、持久会话、无痕模式、缓存和定位。
测试不会访问真实 AI 服务或修改已有用户配置。

## 迁移范围与限制

启动、打包和 CI 使用 Tauri。当前页面已接通对话、生图站点、统一输入、参考图脚本、
回复收集、LLM 汇总、网站设置、无痕会话、代理和虚拟定位。原生端仅允许本地 `main`
WebView 管理设置及其他 WebView；第三方网站不获授任何 Tauri 权限。

以下旧能力没有迁入，调用时返回明确错误：HTTP 生图 API（3920 端口）、多 Preset 窗口、
Agent CLI 安装管理、自动更新。站点输入在系统 WebView 内执行脚本。
真实 AI 平台登录、参考图上传和付费生成未纳入自动测试。

- 首次运行尝试从旧 `ai-tool-box` 配置目录复制受支持的 JSON 设置，绝不修改旧目录。
  不兼容设置备份为新目录下的 `legacy-*.json`；设置损坏或读取失败会明确报错。
- Cookie、网站 localStorage 和旧版加密密钥不能直接复用，需要重新登录并填写 API Key。
  新密钥只保存在系统凭据库，系统凭据库不可用时不会降级为明文存储。
- 普通会话按 partition 共享数据；不同代理配置使用不同 WebView2 数据目录，
  切换代理可能需要重新登录。清理共享会话会影响同分区网站。
- Windows/Linux 支持无认证的 HTTP、SOCKS5 代理；直连覆盖当前仅在 Windows 支持。
  HTTPS 类型、用户名密码代理及本构建的 macOS 手动代理明确拒绝保存。
- 虚拟定位通过页面 Geolocation API 注入实现，不改变系统 GPS 或 IP 地理位置。
- 原生子 WebView 使用 Tauri 的 `unstable` 多 WebView 功能。Windows 已有原生回归测试；
  macOS/Linux 的平台行为仍需在对应系统验证。

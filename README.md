# AI Tool Box

本项目主要用于集成目前市面上主流的 AI 工具，方便用户统一使用。

## 主要功能

- 集成多个主流 AI 工具（ChatGPT、DeepSeek 等）
- 统一界面操作，提升使用体验

## release 分支实现

本分支保留 **React 19 + TypeScript + Vite**，不使用 main 分支的 Svelte 页面。
桌面运行时为 **Tauri 2**，原有业务模块作为随安装包分发的 Node 后台运行，
不需要用户另行安装 Node，也不再启动 Electron。

- 六个页面：对话、生图、生视频、API 工作线程、Agent CLI、设置。
- API：JSON/multipart、SSE、每站点并发工作线程、Bing/Gemini/AI Studio 适配、
  图片下载和调试接口继续使用本分支的业务实现。
- Preset：创建、重命名、删除、多窗口、设置隔离和站点会话隔离。
- Windows：WebView2 原生输入、网络响应捕获、截图、GPS 覆盖。
- LLM 密钥存储到系统凭据库；汇总请求由后台发出。
- 自动更新：Tauri 签名校验、下载进度、安装。发布者需要配置签名公钥/私钥。

`src/desktop` 提供前端适配；`src-tauri` 管理原生窗口/WebView/权限；
`desktop-backend` 保留本分支原有 Node 业务模块。两进程仅通过私有 stdin/stdout
通信，第三方网站没有 Tauri 权限，窗口请求按实际调用者的 Preset 校验。

## 开发与构建

需要 Node 24+、pnpm、Rust stable。Windows 需要 Visual Studio C++ Build Tools 和
WebView2 Runtime。macOS 最低 14（使用独立 WebKit 数据存储及代理），
macOS/Linux 构建依赖见对应平台的 Tauri 文档和 CI 工作流。

```sh
pnpm install
pnpm dev                 # Tauri + Vite
pnpm dev:web             # 仅界面预览，http://127.0.0.1:5173
pnpm build               # 前端构建，保持 release 分支原命令语义
pnpm desktop:build       # 原生安装包
pnpm release             # 保留原有 release 分支版本/tag 发布流程
```

`pnpm dev` 和 `pnpm dev:web` 不应同时占用 5173 端口。
安装包位于 `src-tauri/target/release/bundle`；打包会包含独立 Node 可执行文件、
业务代码及 Node 许可证。应用版本由 `package.json` 提供。

```sh
pnpm type-check
pnpm lint
pnpm test
pnpm test:ui
pnpm desktop:compile
cargo test --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml
# 另一个终端启动 pnpm dev:web 后：
pnpm test:desktop
```

Windows 原生集成测试使用隐藏窗口和 `.cache` 下的独立数据目录，
验证多 Preset、原生输入、会话隔离、截图、缓存、LLM、GPS、API 并发/SSE，
以及真实 React API 页面。测试网站和 LLM 均为本地 fixture，不调用付费 AI 服务。

## API 与升级

API 默认只监听 `127.0.0.1:3920`。设置页可更改端口，冲突时按原有逻辑选择下一个端口。
局域网访问需显式设置 `AI_TOOLBOX_API_LAN=1`（或 `AI_TOOLBOX_API_HOST`）和
`AI_TOOLBOX_API_TOKEN`。有 token 时使用 `X-Api-Token` 或 Bearer 认证；
未配置 token 时拒绝非同源浏览器调用。CLI 的本机访问方式不变。

首次运行尝试复制旧 `ai-tool-box` 配置目录中的 JSON 和 Preset 设置，不覆盖新配置，
不修改旧目录。开发与正式版使用独立目录。Cookie 和 Electron 加密密钥不能直接复用，
需要重新登录站点、重新填写 LLM API Key。代理配置切换系统/手动模式时可能切换原生
WebView 环境；手动上游使用本机中继以支持 HTTP/HTTPS/SOCKS5 和代理认证。

GitHub/Gitea 工作流已切换为 Tauri。签名更新需要：

- `TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：CI secrets。
- `TAURI_UPDATER_PUBLIC_KEY`：CI variable，编译进应用。
- Gitea/自托管可配置 `TAURI_UPDATER_ENDPOINT` 和 `TAURI_RELEASE_DOWNLOAD_BASE`。

没有签名配置仍可生成手动安装包，检查更新会显示配置错误，不跳过签名校验。
已安装的 Electron 版本需手动安装 Tauri 版本，旧 latest.yml/blockmap 不再发布。

## 验证边界

本次原生验证在 Windows 上完成。macOS/Linux 使用系统 WebView，不提供 Chromium
调试协议，因此特殊原生输入、GPS 覆盖和 Gemini/AI Studio 网络捕获路径仍需平台适配；
现有 DOM 回退与普通网页操作保留。弹出链接目前在原 WebView 导航，需要独立 popup
窗口通信的第三方 OAuth 流程需进一步验证。真实网站登录、上传和生成没有在自动测试中调用，
Agent CLI 安装器未实际执行，签名升级需要发布者配置后验证。

# AI Tool Box 文档

集成多个主流 AI 工具的统一桌面应用。

## 开发

```bash
pnpm dev      # Tauri + Node 后台 + Vite 开发模式
pnpm doc      # Docsify 本地文档服务
```

## 功能

- 多 AI 工具 Webview 集成（ChatGPT、DeepSeek 等）

## Developer Notes

本分支保留 React 的对话、生图、生视频、API、Agent CLI 和 Preset 设置。
原生架构与升级说明见仓库 README；原有 Electron 业务代码已迁至 `desktop-backend`。

- [Image Generation Dev Notes](image-gen-dev-notes.md)

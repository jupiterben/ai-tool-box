# AI Tool Box 文档

集成多个主流 AI 工具的统一桌面应用。

## 开发

```bash
pnpm dev      # Tauri + Vite 开发模式
pnpm dev:web  # 仅预览界面，http://127.0.0.1:5175
```

## 功能

- 多 AI 工具 Webview 集成（ChatGPT、DeepSeek 等）

## Developer Notes

- 桌面运行时已切换为 Tauri 2，迁移范围和已知限制见仓库 README。
- 以下生图 API 文档描述已移除的 HTTP 生图服务，当前应用不启动该服务。
- [Image Generation Dev Notes](image-gen-dev-notes.md)

# Google AI Studio Imagen 生图设计

## 目标

新增独立生图工具 `aistudio-image`，通过 webview 登录态抓取 AI Studio Imagen 页真实请求并取图，接入本地 `/api/gen_image`，与现有 `gemini-image` 并存，不改变默认 `toolId`。

## 决策摘要

| 项 | 选择 |
|---|---|
| 深度 | 对标 `gemini-image` 的 web-api（抓包 + 取图） |
| 认证 | webview 登录，不引入 API Key |
| 入口 | 独立 `toolId`，与 `gemini-image` 并存 |
| 落地页 | 默认 `new_chat?model=gemini-2.5-flash-image`（免费）；`imagen-*` 仍走 `new_image`（常需付费） |
| 默认工具 | 仍为 `gemini-image` |

## 架构

```text
UI / CLI / HTTP API
        │  toolId=aistudio-image
        ▼
imageGenService
  ├─ ensure webview → reset 到 Imagen 页
  ├─ 默认 web-api：aistudioImageCreator（抓包 + 下载/解析）
  └─ 失败且未真正发出 → 回退 DOM
        │
        ▼
webview: aistudio.google.com/prompts/new_image?...
```

## 组件

| 组件 | 职责 |
|---|---|
| `src/config/tools.ts` | 注册工具 |
| `src/webview-handlers/sites/image.ts` | Imagen 页 handler（输入/发送/结果选择器） |
| `electron/aistudioImageCreator.ts` | 抓包、解析、下载、`count` 循环 |
| `electron/imageGenService.ts` | 分支调度与 progress / fallback |
| `src/types/image-gen-api.ts` | `aistudio?: { mode?, model?, preferWebApi? }` |
| `docs/image-gen-api.md` + skill constants | 文档与 CLI 工具列表 |

## 数据流（web-api）

1. ensure + reset 到 Imagen URL（可用 `aistudio.model` 覆盖 query）
2. 挂 Network debugger，过滤 AI Studio / Generative Language 生图请求
3. 每轮：发送 prompt → 捕获 request/response → 抽 URL 或 inline base64 → 下载/解码
4. 抽不到响应图时，回退当轮 DOM 等图
5. `count>1` 使用 `(variation N of M)` 轮询，中途失败返回部分 `images`

## 参数

- `aistudio.mode`: `auto` | `web-api` | `dom`（默认 auto ≈ 优先 web-api）
- `aistudio.model`: 默认 `imagen-4.0-generate-001`
- 带 `referenceImage` 时首版走 DOM（与 gemini/bing 对齐）

## 错误处理

- 未登录 / 抓不到请求 / 无图 / 超时：明确 `error`；已发送则不盲发第二轮
- Progress：`aistudio_web_api_start` / `_done` / `_fallback`

## 范围外

- API Key、Chat 图像模型页、改默认 toolId、独立纵横比 API 字段（除非 replay 原样携带）

## 测试

- 单元：URL 过滤、响应解析（fixture）、model URL 构建
- 回归：`gemini-image` 行为不变

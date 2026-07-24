# Image Generation Dev Notes

本文记录生图 API 的关键维护逻辑，尤其是 Gemini webview DOM 发送、循环生成和 SSE stream 接口。

## 入口文件

| 模块 | 作用 |
|---|---|
| `electron/imageGenApi.ts` | 本地 HTTP API，包含 `/api/gen_image` 和 `/api/gen_image/stream` |
| `electron/imageGenService.ts` | 生图主流程：准备 webview、重置页面、循环发送 prompt、等待图片 |
| `electron/webviewInput.ts` | 在 webview 页面内填入 prompt 并触发发送 |
| `electron/webviewExtractImages.ts` | 轮询并转换页面里的生成图片 |
| `src/webview-handlers/sites/image.ts` | 各生图站点的输入框、发送按钮、图片选择器配置 |
| `src/webview-handlers/browserRuntime.ts` | 注入到 webview 页面里的通用 DOM runtime |

## Gemini 第二轮发送修复

现象：

- API 请求 `count > 1` 时，第一轮可以发送。
- 第二轮 prompt 已经进入 Gemini 输入框，但没有真正发送。
- 外部表现为循环停住，最后等图超时。

根因：

- 原先主要依赖页面内 `sendButton.click()` 触发发送。
- Gemini 当前页面使用 rich text editor 和前端框架状态管理，合成 DOM click 在第二轮可能被吞掉。
- 页面里同时存在多个 `Create` / `Generate` / `Send` 相关按钮，旧选择器可能命中非输入框附近的按钮。
- 部分隐藏、0 尺寸或 `pointer-events: none` 的按钮也可能被误判为 ready。

修复逻辑：

1. `electron/webviewInput.ts` 增加 Gemini 原生发送路径 `sendGeminiNative`。
2. 定位 Gemini 输入框，兼容 `contenteditable` 和 `textarea/input`。
3. 清空旧内容：
   - 文本框使用原生 `value` setter 并派发 `input` 事件。
   - 富文本输入框使用 selection + `document.execCommand('delete')`。
4. 写入 prompt：
   - 富文本优先用 `document.execCommand('insertText')`，让编辑器内部 state 同步。
   - 文本框使用原生 setter + `input/change` 事件。
5. 等发送按钮出现并可用。
6. 不再只用页面内 `click()`，而是读取按钮 `getBoundingClientRect()` 中心点。
7. 主进程用 Electron `webContents.sendInputEvent` 发送真实鼠标事件。
8. 点击后验证输入框是否清空；如果仍残留 prompt，再补一次原生 Enter。

维护原则：

- Gemini 这类 React/Angular/rich-editor 页面，优先使用 Electron 原生输入事件完成最终发送动作。
- DOM 注入负责找元素、填内容、取坐标；主进程负责真实点击或键盘事件。
- 成功判断不要只看点击是否执行，而要看输入框残留内容是否消失。

## 按钮定位与可用性判断

相关文件：

- `src/webview-handlers/sites/image.ts`
- `src/webview-handlers/browserRuntime.ts`

Gemini 配置里增加了：

- `nearInputSendSelectors`
- `preferNearInputSendButton: true`
- 更长的 `sendButtonWaitMs`

目的：

- 优先找输入框附近的 `Send` / `Submit` 按钮。
- 避免命中页面顶部、历史回复区或工具面板里的其它按钮。
- `waitForWebviewSendReady` 在 `preferNearInputSendButton` 站点只检查输入框附近按钮；附近无按钮且不在生成中即视为可发下一条，避免被页面其它 disabled 按钮误判为 `send-disabled` 而卡死第二轮。

`__isSendReady` 也做了收紧：

- `aria-disabled="true"` 不可用。
- `disabled` 不可用。
- `aria-hidden` 或位于 `aria-hidden` 容器内不可用。
- 0 宽高不可用。
- `display:none`、`visibility:hidden`、`pointer-events:none` 不可用。

这能避免把隐藏按钮或正在生成期间的按钮当作可发送状态。

## Count 循环流程

相关文件：`electron/imageGenService.ts`

`count` 的循环并不是一次性向站点请求多张图，而是在同一个 webview 对话里按轮次发送：

```text
reset webview
detect existing image origins as baseline
for each round:
  wait send ready, except first round
  send prompt
  wait for one new image not in baseline
  add image origin to seen set
return collected images
```

第二轮及后续轮次会先调用 `waitForWebviewSendReady`。

这样做是为了等上一轮生成结束，避免新 prompt 在站点仍处于生成中时被输入但不能发送。

### 为什么会看到 `(variation 3 of 4)`，但看不到 `(variation 2 of 4)`

`buildRoundPrompt` 的编号规则是：

```text
round 1: 原始 prompt
round 2: 原始 prompt (variation 2 of 4)
round 3: 原始 prompt (variation 3 of 4)
round 4: 原始 prompt (variation 4 of 4)
```

所以如果页面里能看到 `(variation 3 of 4)`，说明循环索引已经推进到了第 3 轮；`(variation 2 of 4)` 不见了，通常不是编号算错，而是第 2 轮没有真正进入 Gemini 对话，或者第 2 轮发送后的图片等待误采到了上一轮延迟出现的图片。

为避免这种“跳轮但继续执行”的情况：

- Gemini 原生发送确认必须同时满足输入框清空和页面正文出现本轮 prompt。
- 任意中间轮次失败时，接口返回 `success:false`，并带上已经生成到的部分 `images`，不再静默当作成功。

## 图片提取注意点

相关文件：

- `electron/webviewExtractImages.ts`
- `src/webview-handlers/imageResultRuntime.ts`
- `src/webview-handlers/sites/image.ts`

Gemini 图片可能表现为：

- `blob:https://gemini.google.com/...`
- `alt` 包含 `AI generated`
- 页面 DOM 中短时间内 `naturalHeight` 或 layout height 为 `0`

维护注意：

- 不要只用 DOM 高度判断生成是否成功。
- API 最终可用性的核心是能否拿到 `base64` / `dataUrl`。
- `originSrc` 只用于内部去重，返回给客户端前会通过 `sanitizeImagesForApi` 去掉。

## SSE Stream API

新增接口：`POST /api/gen_image/stream`

相关文件：

- `electron/imageGenApi.ts`
- `electron/imageGenService.ts`

设计：

- 请求体与 `/api/gen_image` 一致。
- 响应类型为 `text/event-stream`。
- 同步接口 `/api/gen_image` 保持不变。
- service 层通过 `onProgress` 回调上报进度。
- API 层把进度事件转成 SSE event。

事件顺序通常是：

```text
accepted
start
webview_ready
reset_start
reset_done
round_start
send_ready       # second and later rounds
send_retry       # only when retrying
send_done
wait_image
image
done
```

失败时会输出：

```text
error
done             # generation function returned a structured result
```

`image` 事件会携带单张图片：

```json
{
  "type": "image",
  "toolId": "gemini-image",
  "round": 1,
  "totalRounds": 2,
  "image": {
    "base64": "...",
    "mimeType": "image/png",
    "dataUrl": "data:image/png;base64,..."
  }
}
```

`done` 事件会携带与同步接口一致的最终结果：

```json
{
  "type": "done",
  "result": {
    "success": true,
    "toolId": "gemini-image",
    "images": []
  }
}
```

## 验证清单

改动 Gemini 发送或图片提取后，建议至少跑：

```bash
pnpm run electron:compile
```

同步接口：

```bash
curl -X POST http://127.0.0.1:3920/api/gen_image \
  -H "Content-Type: application/json" \
  -d '{"toolId":"gemini-image","prompt":"Create an image of a simple blue square icon on a plain white background.","count":2,"timeoutMs":300000}'
```

Stream 接口：

```bash
curl -N -X POST http://127.0.0.1:3920/api/gen_image/stream \
  -H "Content-Type: application/json" \
  -d '{"toolId":"gemini-image","prompt":"Create an image of a simple green triangle icon on a plain white background.","count":1,"timeoutMs":180000}'
```

期望：

- `health.features` 包含 `stream`。
- `count=2` 能返回 2 张图。
- stream 能看到 `image` 和 `done` 事件。

## Known Type Check Noise

当前 `pnpm run type-check` 仍可能被以下既有问题阻塞：

- `electron/bingImageCreator.ts` 中未使用变量。
- `electron/imageGenRequestParser.ts` 中 `Buffer.endsWith` 类型问题。
- `electron/proxyManager.ts` 中 legacy proxy 类型不匹配。

这些不是 Gemini 发送修复或 stream API 引入的问题。当前相关改动至少应保证 `pnpm run electron:compile` 通过。

## Experimental Gemini Page Fetch

Gemini does not expose a stable public image-generation Web API for this app. The experimental path reuses the logged-in Gemini page itself.

Current stable strategy:

1. Reset and open the normal `gemini-image` webview.
2. For each round, attach Electron debugger `Network` capture before sending.
3. Send the prompt through the existing DOM/native-input path so Gemini's own frontend builds a fresh `StreamGenerate` request.
4. Capture that round's real `StreamGenerate` request and response body.
5. Parse returned Google image URLs and download them through the same webview session.
6. If the response body does not expose a downloadable URL, fall back to DOM new-image detection for that same round.

Why this is more stable:

- It no longer replays the first round request body.
- Each round gets fresh Gemini-generated ids, conversation state, and throttling behavior.
- It avoids the false quota response caused by reusing stale `c_...` / `r_...` / request state.
- `AI_TOOLBOX_GEMINI_WEB_API_REPLAY=1` keeps the older replay path available for debugging only.

Older replay strategy, kept only as a debug fallback:

1. Reset and open the normal `gemini-image` webview.
2. Attach Electron debugger `Network` capture to that webview.
3. Send the first prompt through the existing DOM/native-input path.
4. Capture the page's own `StreamGenerate` request URL, headers, and POST body.
5. For remaining requested rounds, execute `fetch(...)` inside the Gemini page with `credentials: "include"`.
6. Parse returned Google image URLs and download them through the same webview session.

Enable per request:

```json
{
  "toolId": "gemini-image",
  "prompt": "Create a clean product icon of a glass teapot on white background.",
  "count": 2,
  "timeoutMs": 240000,
  "gemini": {
    "mode": "web-api"
  }
}
```

Equivalent multipart fields:

```text
toolId=gemini-image
prompt=Create a clean product icon of a glass teapot on white background.
count=2
geminiMode=web-api
```

Operational notes:

- Gemini now defaults to this stable page-captured web-api path. Use `gemini.mode="dom"` or `gemini.preferWebApi=false` to force DOM/native input.
- Bing also supports `bing.mode`: it defaults to the internal web API path; use `bing.mode="dom"` or `bing.preferWebApi=false` to force DOM.
- The stable page-fetch path captures every round instead of reusing a previous request body.
- If capture fails before an image is collected, the service falls back to DOM. If a partial result already exists, the API returns `success:false` with partial `images`.
- `AI_TOOLBOX_GEMINI_WEB_API=1` can force this experiment globally during local testing.

Test command:

```bash
curl -X POST http://127.0.0.1:3920/api/gen_image \
  -H "Content-Type: application/json" \
  -d '{"toolId":"gemini-image","prompt":"Create a simple blue glass teapot icon on a plain white background.","count":2,"timeoutMs":240000,"gemini":{"mode":"web-api"}}'
```

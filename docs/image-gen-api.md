# 生图 API 文档

AI Tool Box 启动后，主进程会在本机自动开启 HTTP 服务，通过内嵌 webview 调用各 AI 生图站点（如 Gemini）完成生图，并返回 **base64** 图片。

## 基本信息

| 项 | 值 |
|---|---|
| 地址 | `http://<本机IP>:3920`（默认监听局域网） |
| 本机 | `http://127.0.0.1:3920` |
| 协议 | HTTP |
| 启动条件 | 应用运行中（`pnpm dev` 或安装包启动） |
| 默认工具 | `gemini-image` |
| 默认超时 | 120 秒 |
| 参考图上限 | 10 MB |

## 鉴权（可选）

设置环境变量 `AI_TOOLBOX_API_TOKEN` 后，请求需携带以下任一 Header：

```
X-Api-Token: <your-token>
Authorization: Bearer <your-token>
```

未设置该环境变量时，无需鉴权。默认开启局域网访问，**建议配置 token**。

### 局域网访问

**默认已开启**，监听 `0.0.0.0:3920`，局域网内设备可通过 `http://<本机IP>:3920` 访问。启动后控制台会打印可用地址：

```
[imageGenApi]   → http://127.0.0.1:3920
[imageGenApi]   → http://192.168.1.100:3920
```

若只需本机访问，启动前设置：

```bash
# Windows PowerShell
$env:AI_TOOLBOX_API_LAN="0"
pnpm dev

# Linux / macOS
AI_TOOLBOX_API_LAN=0 pnpm dev
```

或显式指定：

```bash
AI_TOOLBOX_API_HOST=127.0.0.1 pnpm dev
```

局域网内其他设备调用示例：

```bash
curl http://192.168.1.100:3920/api/health

curl -X POST http://192.168.1.100:3920/api/gen_image \
  -H "Content-Type: application/json" \
  -H "X-Api-Token: your-secret-token" \
  -d '{"prompt":"一只猫在太空"}'
```

> 局域网环境下**强烈建议**配置 `AI_TOOLBOX_API_TOKEN`。

---

## GET /api/health

健康检查。

**响应示例：**

```json
{
  "success": true,
  "service": "ai-tool-box-image-gen",
  "port": 3920,
  "host": "0.0.0.0",
  "lanEnabled": true,
  "accessUrls": [
    "http://127.0.0.1:3920",
    "http://192.168.1.100:3920"
  ],
  "features": ["prompt", "referenceImage", "multipart-upload"]
}
```

---

## POST /api/gen_image

提交生图任务，同步等待结果（通常 30–120 秒）。

### 请求方式

支持两种 Content-Type：

1. `application/json`
2. `multipart/form-data`（上传参考图文件）

### 参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `prompt` | string | 条件必填 | 生图提示词；与参考图至少填一个 |
| `toolId` | string | 否 | 生图工具 ID，默认 `gemini-image` |
| `timeoutMs` | number | 否 | 等待超时（毫秒），默认 `120000` |
| `referenceImage` | object | 否 | 参考图（JSON 完整格式） |
| `referenceImageBase64` | string | 否 | 参考图纯 base64（JSON 简写） |
| `referenceImageMimeType` | string | 否 | 简写时的 MIME，默认 `image/png` |
| `referenceImageName` | string | 否 | 简写时的文件名，默认 `reference.png` |

**referenceImage 对象：**

```json
{
  "name": "ref.png",
  "mimeType": "image/png",
  "dataUrl": "data:image/png;base64,iVBORw0KG..."
}
```

仅提供参考图、无 `prompt` 时，内部默认使用提示词：`基于参考图生成`。

### 支持的 toolId

| toolId | 说明 |
|---|---|
| `gemini-image` | Gemini 生图（默认） |
| `jimeng` | 即梦 AI |
| `wanxiang` | 通义万相 |
| `kling` | 可灵 AI |
| `liblib` | LiblibAI |
| `yige` | 文心一格 |
| `miaohua` | 秒画 |
| `doubao-image` | 豆包绘图 |
| `midjourney` | Midjourney |
| `leonardo` | Leonardo.ai |
| `ideogram` | Ideogram |
| `firefly` | Adobe Firefly |
| `bing-create` | Bing 创建 |
| `stability` | Stability AI |
| `recraft` | Recraft |

> 需在对应 webview 中已登录账号，否则生图会失败。

---

## 请求示例

### 1. 纯文本 prompt（JSON）

```bash
curl -X POST http://127.0.0.1:3920/api/gen_image \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "gemini-image",
    "prompt": "一只猫在太空漫步，赛博朋克风格",
    "timeoutMs": 120000
  }'
```

### 2. JSON + 参考图（dataUrl）

```bash
curl -X POST http://127.0.0.1:3920/api/gen_image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "把这张图变成水彩风格",
    "referenceImage": {
      "name": "photo.png",
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,iVBORw0KG..."
    }
  }'
```

### 3. JSON + 参考图（base64 简写）

```json
{
  "prompt": "把这张图变成水彩风格",
  "referenceImageBase64": "iVBORw0KG...",
  "referenceImageMimeType": "image/png",
  "referenceImageName": "photo.png"
}
```

### 4. multipart 上传参考图

```bash
curl -X POST http://127.0.0.1:3920/api/gen_image \
  -F "prompt=把这张图变成水彩风格" \
  -F "toolId=gemini-image" \
  -F "referenceImage=@/path/to/photo.png"
```

文件字段名也支持：`file`、`image`。

### 5. PowerShell

```powershell
$body = @{
  toolId = "gemini-image"
  prompt = "a cute panda eating bamboo"
  timeoutMs = 120000
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3920/api/gen_image" `
  -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
```

---

## 响应

### 成功（HTTP 200）

```json
{
  "success": true,
  "toolId": "gemini-image",
  "prompt": "一只猫在太空漫步，赛博朋克风格",
  "images": [
    {
      "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,iVBORw0KGgo...",
      "width": 1024,
      "height": 559,
      "alt": ", AI generated"
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `base64` | 纯 base64 字符串（不含 `data:` 前缀） |
| `mimeType` | 图片 MIME 类型 |
| `dataUrl` | 完整 data URL，可直接用于 `<img src>` |
| `width` / `height` | 图片尺寸（像素） |

### 失败

| HTTP | 场景 |
|---|---|
| 400 | 请求格式错误、缺少必填字段、参考图过大 |
| 401 | 鉴权失败 |
| 500 | 生图失败（webview 未就绪、发送失败、超时等） |

```json
{
  "success": false,
  "toolId": "gemini-image",
  "prompt": "...",
  "error": "生图超时，未检测到新图片"
}
```

---

## 工作流程

```
POST /api/gen_image
    │
    ├─ 自动切换到「生图」页，挂载对应 webview
    ├─ 注入 prompt（+ 上传参考图，如有）
    ├─ 轮询 webview DOM，等待新图片出现
    └─ 转换为 base64 并返回 JSON
```

首次调用可能需要数秒挂载 webview；Gemini 等站点需提前在应用内登录。

---

## 注意事项

1. **默认监听局域网**（`0.0.0.0`）；仅需本机时设置 `AI_TOOLBOX_API_LAN=0` 或 `AI_TOOLBOX_API_HOST=127.0.0.1`。
2. **同步接口**：生图耗时较长，客户端请设置足够超时（建议 ≥ 180 秒）。
3. **登录态**：依赖 webview 内站点登录，API 无法代填账号密码。
4. **并发**：同一 webview 不建议并发请求，建议串行调用。
5. **参考图格式**：支持 PNG / JPEG / WebP / GIF，单张 ≤ 10 MB。

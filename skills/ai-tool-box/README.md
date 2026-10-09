# ai-tool-box

Call the local **AI Tool Box** image generation API at
`http://127.0.0.1:3920` and save the returned base64 images to disk.

```
node src/cli.js "Studio photo of a black boxer brief on white" --count 8
```

```
node src/cli.js "product shot" --tool-id gemini-image,jimeng,wanxiang --count 1
```

## How it works

```
┌──────────┐    POST /api/gen_image    ┌──────────────────┐    webview     ┌──────────────────────┐
│  cli.js  │ ────────────────────────▶ │  AI Tool Box     │ ─────────────▶ │ gemini / jimeng /    │
│ (Node)   │ ◀──── base64 JSON ─────── │  (port 3920)     │ ◀─ image ───── │ wanxiang / ...       │
└────┬─────┘                           └──────────────────┘                └──────────────────────┘
     │
     ▼  write to disk
  ./images/foo-1.png
```

- **No browser automation** — AI Tool Box handles login / automation detection via its embedded webviews.
- **No API keys** — uses existing AI Tool Box sessions.
- **15 sources** — see `--list-tools`. The primary/default source is **gemini-image** (the only one fully verified). Use `--tool-id` to switch only when the user explicitly requests a different source.

## Setup (one-time)

### 1. Install dependencies

```powershell
cd "$HOME\.config\opencode\skills\ai-tool-box"
npm install
```

No runtime deps — pure Node 18+.

### 2. Edit `config.json`

Defaults: `apiBase=http://127.0.0.1:3920`, `toolId=gemini-image`,
`outputDir=./images`, `timeoutMs=180000`.

If AI Tool Box is started with `AI_TOOLBOX_API_TOKEN=<something>`, put
that same value in `apiToken`.

### 3. Start AI Tool Box

Start the AI Tool Box app (e.g. `pnpm dev` in its repo) or launch the
installed desktop build. Verify:

```powershell
node ./src/cli.js --health
```

### 4. Sign in inside AI Tool Box

Open each source's webview (Gemini, 即梦, 万相, …) inside AI Tool Box and
sign in once. After that, the CLI just hits the API — no per-run login.

### 5. Generate

```powershell
# Single source
node ./src/cli.js "Studio photo of a black boxer brief" --count 8

# Multi-source comparison
node ./src/cli.js "lifestyle shot" --tool-id gemini-image,jimeng,wanxiang --count 1
```

## CLI reference

```
Usage:
  aitoolbox-img "your prompt here" [options]

Options:
  --count N            Run the prompt N times per source (default: 1).
  --output DIR         Override outputDir from config.json.
  --tool-id ID[,ID..]  Comma-separated tool IDs. Default: gemini-image.
  --timeout-ms MS      Per-request timeout (default: 180000).
  --api-base URL       Override apiBase from config.json.
  --ref PATH           Reference image file (sent as base64).
  --health             Call /api/health and exit.
  --list-tools         List all supported tool IDs.
  --show-config        Print config path and exit.
  -h, --help           Help.
```

## Supported sources

`gemini-image` · `aistudio-image` · `jimeng` · `wanxiang` · `kling` · `liblib` · `yige` ·
`miaohua` · `doubao-image` · `midjourney` · `leonardo` · `ideogram` ·
`firefly` · `bing-create` · `stability` · `recraft`

Run `--list-tools` for descriptions. Each source must be logged in once
inside AI Tool Box.

## Inside opencode

The skill (`SKILL.md`) instructs the agent to invoke the CLI. Just say:

> 用 AI 工具箱生图 8 张:男士内裤,亚洲模特,LV 花纹
> 对比一下 gemini 和即梦各出一张同样的图

The agent runs the CLI and consumes the file paths it prints.

## Troubleshooting

| Symptom                                       | Fix                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `AI Tool Box API not reachable`               | Start AI Tool Box (e.g. `pnpm dev` in its repo).                           |
| `HTTP 401`                                    | Set `apiToken` in `config.json` to match `AI_TOOLBOX_API_TOKEN`.           |
| `HTTP 500` "生图超时"                         | That source didn't return an image within `timeoutMs`. Retry / shorten prompt. |
| Source returns "browser not secure"           | Sign in once inside AI Tool Box — its webview is configured for this.      |
| All images come back blank / wrong subject    | Refine the prompt; AI Tool Box passes it straight to the underlying model. |
| Want to compare outputs across sources        | Use `--tool-id gemini-image,jimeng,wanxiang` — one prompt, N images each.  |

## Files

```
ai-tool-box/
├── SKILL.md          opencode skill definition
├── README.md         this file
├── package.json
├── config.json       user-editable settings
└── src/
    ├── cli.js        standalone CLI entry
    ├── config.js     config loader
    ├── constants.js  tool registry (15 sources)
    └── api.js        AI Tool Box HTTP client
```

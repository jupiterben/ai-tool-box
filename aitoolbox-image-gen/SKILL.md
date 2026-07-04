---
name: aitoolbox-image-gen
description: Generate images via the local AI Tool Box HTTP API (POST /api/gen_image, http://127.0.0.1:3920). The primary/default source is gemini-image (Gemini 生图) — use it first. Also supports jimeng, wanxiang, kling, and 11 other sources; use `--tool-id ID` to switch. Use when the user wants to create images through AI Tool Box's logged-in webviews. Triggers on requests like "用 AI 工具箱生图", "用 gemini 出图", "出 X 张产品图", or any task that maps to the AI Tool Box image-gen API doc. Only use non-gemini tools if the user explicitly asks for a specific source.
---

# AI Tool Box Image Generation

Call the local AI Tool Box image generation API and save the returned
base64 images to disk. Supports **15 image sources** — see `--list-tools`.

API doc: see `docs/image-gen-api.md` in the AI Tool Box repository.

## When to use

- The user wants to generate images via AI Tool Box (not direct browser automation)
- The user has AI Tool Box running locally (or is willing to start it)
- The user is already logged in to the relevant site(s) inside AI Tool Box's webview
- The user wants to compare outputs from multiple sources in one shot

## How to use

Run the CLI from this skill's directory:

```bash
node ./src/cli.js "PROMPT" [options]
```

Or, after `npm install -g .` (or via `npm link`), use the bin alias:

```bash
aitoolbox-img "PROMPT" [options]
```

Common options:

- `--tool-id ID[,ID..]` — pick source(s). Single ID, or comma-separated for multi-source.
- `--count N` — runs per source (default 1). Total images = N × number of sources.
- `--list-tools` — print all 15 supported sources.
- `--output DIR` — override the output directory from `config.json` (default `./images`)
- `--timeout-ms MS` — per-request timeout (default `180000`)
- `--ref PATH` — reference image, sent as base64
- `--health` — call `/api/health` and exit (verify AI Tool Box is up)

## Examples

```bash
# Single source, 4 images
aitoolbox-img "Studio shot of boxer briefs" --count 4

# Multiple sources in one call (best for A/B comparison)
aitoolbox-img "Product photo of black cotton boxer briefs, Asian male model, monogram canvas pattern" \
  --tool-id gemini-image,jimeng,wanxiang --count 1

# Long-running batch with output into a custom folder
aitoolbox-img "lifestyle shot" --count 8 --output "./out/lifestyle"
```

The CLI prints the saved file paths on stdout, one per line.

## Configuration (`config.json`)

| Key         | Default                  | Notes                                       |
| ----------- | ------------------------ | ------------------------------------------- |
| `apiBase`   | `http://127.0.0.1:3920`  | Override with `--api-base`.                 |
| `apiToken`  | `""`                     | Match `AI_TOOLBOX_API_TOKEN` if set.        |
| `toolId`    | `gemini-image`           | Default source; override with `--tool-id`.  |
| `outputDir` | `./images`               | Override with `--output`.                   |
| `timeoutMs` | `180000`                 | Override with `--timeout-ms`.               |

## Supported sources (run `--list-tools` for the canonical list)

`gemini-image` · `jimeng` · `wanxiang` · `kling` · `liblib` · `yige` ·
`miaohua` · `doubao-image` · `midjourney` · `leonardo` · `ideogram` ·
`firefly` · `bing-create` · `stability` · `recraft`

Each source uses AI Tool Box's own embedded webview, so the user just needs
to sign in once per source inside AI Tool Box.

## Prerequisites

1. AI Tool Box is running (e.g. `pnpm dev` in the AI Tool Box repo, or the installed build)
2. The webview(s) for the chosen `toolId`(s) are logged in
3. The API is reachable — `curl http://127.0.0.1:3920/api/health` should return JSON

## Failure modes to surface to the user

- "AI Tool Box API not reachable" — they need to start AI Tool Box
- `HTTP 401` — `AI_TOOLBOX_API_TOKEN` mismatch; update `config.json`
- `HTTP 500` with "生图超时" — AI Tool Box couldn't get an image within `timeoutMs`; retry or shorten the prompt
- "Couldn't sign you in" inside the webview — has to be resolved inside AI Tool Box's own UI
- Unknown tool id — CLI prints a warning and continues; check `--list-tools`

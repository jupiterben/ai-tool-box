# AI Studio Imagen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `aistudio-image` as an independent image tool with gemini-style web-api capture on the Imagen page.

**Architecture:** Register tool + site handler; implement `electron/aistudioImageCreator.ts` (debugger capture → parse images → download); wire `imageGenService` with web-api default and DOM fallback; document + skill list.

**Tech Stack:** Electron debugger Network API, existing webview handlers, local image-gen HTTP API.

## Global Constraints

- toolId: `aistudio-image` (do not change default `gemini-image`)
- Landing URL: `https://aistudio.google.com/prompts/new_image?model=imagen-4.0-generate-001`
- Auth: webview session only (no API key)
- Reference images: DOM path only in v1
- Do not modify unrelated Agent CLI WIP files

---

### Task 1: Tool registration + site handler

**Files:**
- Modify: `src/config/tools.ts`
- Modify: `src/webview-handlers/sites/image.ts`
- Modify: `skills/ai-tool-box/src/constants.js`
- Modify: `docs/image-gen-api.md`

**Interfaces:**
- Produces: tool id `aistudio-image`, `aistudioImageHandler` in `IMAGE_HANDLERS`

- [ ] **Step 1:** Add tool entry after `gemini-image` in `DEFAULT_IMAGE_TOOLS`
- [ ] **Step 2:** Add `aistudioImageHandler` with Imagen URL / selectors; export in `IMAGE_HANDLERS`
- [ ] **Step 3:** Add to skill `KNOWN_TOOLS` and API docs table

### Task 2: API types + request parser

**Files:**
- Modify: `src/types/image-gen-api.ts`
- Modify: `electron/imageGenRequestParser.ts`

**Interfaces:**
- Produces: `AiStudioImageOptions`, `GenImageRequest.aistudio`

- [ ] **Step 1:** Add `AiStudioImageOptions` with `mode`, `preferWebApi`, `model`
- [ ] **Step 2:** Parse `aistudio` from JSON/multipart like `gemini`

### Task 3: Creator + unit tests (TDD)

**Files:**
- Create: `electron/aistudioImageCreator.ts`
- Create: `tests/aistudioImageCreator.test.ts`
- Modify: `package.json` test script

**Interfaces:**
- Produces: `buildAiStudioImageUrl(model?)`, `shouldCaptureAiStudioRequest(url)`, `extractImagesFromAiStudioText(text)`, `generateAiStudioImagesViaPageFetch(wc, options)`

- [ ] **Step 1:** Write failing unit tests for URL filter + response parsing + model URL
- [ ] **Step 2:** Implement creator (native capture-per-round path, gemini-shaped)
- [ ] **Step 3:** Run unit tests; add to `pnpm test`

### Task 4: Wire imageGenService

**Files:**
- Modify: `electron/imageGenService.ts`

- [ ] **Step 1:** Add `shouldUseAiStudioPageFetch` + `generateAiStudioViaPageFetch`
- [ ] **Step 2:** Branch like gemini; progress events `aistudio_web_api_*`
- [ ] **Step 3:** `type-check` / compile

---

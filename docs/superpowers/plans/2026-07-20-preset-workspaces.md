# Preset 工作区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可命名的 Preset 工作区：Default 内置、可增删改、每 Preset 独立设置与登录态，切换时新开窗口且每 Preset 最多一窗。

**Architecture:** 主进程维护 Preset 注册表与 `Map<presetId, BrowserWindow>`；每个窗口注入 `presetId`；webview 统一使用 `persist:preset-{presetId}`（同 Preset 工具共享 Cookie）。Preset 级设置存 `userData/presets/{id}/`；渲染侧 localStorage 键带 `presetId` 后缀。因 Chromium session 级代理，**同 Preset 只配一个上游 + 一份 GPS**；若需按站分流，上游指向本机 Clash 等，由该代理做域名路由（应用内不做规则引擎）。

**Tech Stack:** Electron 43、React 19、TypeScript、现有 IPC/`electronAPI`、node:test。

**Spec:** `docs/superpowers/specs/2026-07-20-preset-workspaces-design.md`

## Global Constraints

- Default Preset `id` 固定为 `default`，不可删除。
- 分区名格式：`persist:preset-{presetId}`（禁止再新增 `persist:tool-*`）。
- 每 Preset 最多一个 `BrowserWindow`；已存在则 `focus()`。
- 旧 Cookie（`persist:tool-*`）本版不迁移。
- 主题 / LLM / Agent CLI / 生图 API 保持全局。
- 同 Preset 共享 session ⇒ **一份上游代理 + 一份 GPS**；去掉每 tool `setProxy`。
- **不做**应用内按站点分流 UI；文案提示：多出口请用本机代理规则。

---

## File Map

| 文件 | 职责 |
|------|------|
| `src/types/preset.ts` | Preset 类型与常量 |
| `src/utils/toolPartition.ts` | 改为 `getPresetPartition(presetId)`；保留弃用包装 |
| `electron/presetRegistry.ts` | 注册表 CRUD、新建时拷贝 Default 工具启用 |
| `electron/presetWindowManager.ts` | 开窗 / 聚焦 / 关窗反注册 |
| `electron/presetSettingsStore.ts` | 每 Preset 的 tool/proxy/geo/selected 读写与迁移 |
| `electron/webviewSession.ts` | `clearPresetWebviewData(presetId)` |
| `electron/proxyManager.ts` / `geolocationManager.ts` | 按 preset 分区 apply |
| `electron/main.ts` | 启动 Default 窗；注册 preset IPC |
| `electron/preload.ts` | 暴露 `getPresetId`、preset CRUD、openPreset |
| `src/hooks/usePresetContext.ts` | 渲染进程读取当前 `presetId` |
| `src/components/PresetSwitcher/*` | 侧栏切换器 UI |
| `src/components/PresetSettings/PresetSettingsPanel.tsx` | 设置页管理 |
| `src/utils/settingsStorage.ts` + hooks | 键名纳入 `presetId` |
| 所有 `getToolPartition` 调用点 | 改传 `presetId` |

---

### Task 1: Preset 类型与 partition 工具

**Files:**
- Create: `src/types/preset.ts`
- Modify: `src/utils/toolPartition.ts`
- Create: `tests/presetPartition.test.ts`
- Modify: `package.json`（`test` 脚本加入新测试文件）

**Interfaces:**
- Produces:
  - `DEFAULT_PRESET_ID = 'default'`
  - `PresetMeta { id, name, createdAt, order?: number }`
  - `PresetRegistry { version: '1.0.0', presets: PresetMeta[] }`
  - `getPresetPartition(presetId: string): string` → `persist:preset-${presetId}`
  - `getToolPartition(toolId: string): string` 标记 deprecated，实现改为抛错或文档要求调用方迁移（本任务先改为接收可选第二参，见步骤）

- [ ] **Step 1: 写失败测试**

```ts
// tests/presetPartition.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPresetPartition, DEFAULT_PRESET_ID } from '../src/utils/toolPartition.ts';

test('getPresetPartition uses persist:preset- prefix', () => {
  assert.equal(getPresetPartition('default'), 'persist:preset-default');
  assert.equal(getPresetPartition('preset-abc'), 'persist:preset-preset-abc');
});

test('DEFAULT_PRESET_ID is default', () => {
  assert.equal(DEFAULT_PRESET_ID, 'default');
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --experimental-strip-types --test tests/presetPartition.test.ts`  
Expected: FAIL（`getPresetPartition` 未导出）

- [ ] **Step 3: 实现类型与函数**

`src/types/preset.ts`:

```ts
export const DEFAULT_PRESET_ID = 'default';
export const PRESET_REGISTRY_VERSION = '1.0.0';

export interface PresetMeta {
  id: string;
  name: string;
  createdAt: number;
  order?: number;
}

export interface PresetRegistry {
  version: string;
  presets: PresetMeta[];
}

export function createDefaultPresetMeta(): PresetMeta {
  return {
    id: DEFAULT_PRESET_ID,
    name: '默认',
    createdAt: 0,
    order: 0,
  };
}
```

`src/utils/toolPartition.ts`:

```ts
export { DEFAULT_PRESET_ID } from '../types/preset';

export function getPresetPartition(presetId: string): string {
  if (!presetId?.trim()) {
    throw new Error('presetId is required');
  }
  return `persist:preset-${presetId}`;
}

/** @deprecated 使用 getPresetPartition(presetId)；过渡期勿再按 tool 分 partition */
export function getToolPartition(_toolId: string): string {
  throw new Error('getToolPartition is removed; use getPresetPartition(presetId)');
}
```

- [ ] **Step 4: 跑通测试**

Run: `node --experimental-strip-types --test tests/presetPartition.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/preset.ts src/utils/toolPartition.ts tests/presetPartition.test.ts package.json
git commit -m "feat(preset): add preset types and partition helper"
```

---

### Task 2: Preset 注册表（主进程）

**Files:**
- Create: `electron/presetRegistry.ts`
- Create: `tests/presetRegistry.test.ts`（纯函数：`ensureDefault`、`createPresetMeta`、删除校验；文件 IO 可抽 `parseRegistry`）

**Interfaces:**
- Consumes: `PresetMeta`, `PresetRegistry`, `DEFAULT_PRESET_ID`, `PRESET_REGISTRY_VERSION`
- Produces:
  - `loadPresetRegistry(): Promise<PresetRegistry>`
  - `savePresetRegistry(registry: PresetRegistry): Promise<void>`
  - `listPresets(): Promise<PresetMeta[]>`
  - `createPreset(name: string): Promise<PresetMeta>` — id = `preset-${crypto.randomUUID()}`
  - `renamePreset(id: string, name: string): Promise<PresetMeta>`
  - `deletePreset(id: string): Promise<void>` — `default` 抛错
  - `getPreset(id: string): Promise<PresetMeta | null>`

存储路径：`join(app.getPath('userData'), 'preset-registry.json')`

- [ ] **Step 1: 写 `ensureRegistryDefaults` 单测**

```ts
test('ensureRegistryDefaults inserts default when empty', () => {
  const r = ensureRegistryDefaults({ version: '1.0.0', presets: [] });
  assert.equal(r.presets[0].id, 'default');
  assert.equal(r.presets[0].name, '默认');
});

test('deletePreset rejects default', async () => {
  await assert.rejects(() => deletePresetInMemory(registry, 'default'), /不可删除/);
});
```

将可测逻辑导出为不依赖 `app` 的纯函数；`load/save` 包一层读文件。

- [ ] **Step 2: 实现 `electron/presetRegistry.ts`**
- [ ] **Step 3: 测试 PASS**
- [ ] **Step 4: Commit** `feat(preset): add preset registry CRUD`

---

### Task 3: Preset 设置存储与 Default 迁移

**Files:**
- Create: `electron/presetSettingsStore.ts`
- Modify: `electron/proxyManager.ts`（路径改为可注入 `presetId`）
- Modify: `electron/geolocationManager.ts`（同上）

**Interfaces:**
- Produces:
  - `getPresetDir(presetId: string): string` → `userData/presets/{presetId}/`
  - `loadPresetToolSettings(presetId)` / `save…`
  - `loadPresetProxySettings(presetId)` / `save…`
  - `loadPresetGeolocationSettings(presetId)` / `save…`
  - `loadPresetSelectedTools(presetId, category)` / `save…`（若仍只放渲染进程，则本任务只迁 proxy/geo/tool disabled；selected 见 Task 6）
  - `migrateLegacySettingsIntoDefault(): Promise<void>`  
    若 `presets/default/` 不存在：把现有 `proxy-settings.json`、`geolocation-settings.json` 以及（若主进程有）tool settings 复制进 Default；然后保留旧文件作只读备份或标记 `migrated: true`
  - `copyPresetSettings(fromId, toId): Promise<void>` — 新建 Preset 时拷贝 Default 的 **tool disabled 列表**（及可选 proxy/geo 默认值）；**不**拷贝 session Cookie
  - `deletePresetSettings(presetId): Promise<void>` — `rm` 目录

**代理 apply 变更（本任务一并改签名，Task 5 接窗）：**

```ts
export async function applyPresetProxy(
  presetId: string,
  settings: ProxySettings,
  sessionConfig: { mode: ProxyMode; profileId?: string }
): Promise<void> {
  const partition = getPresetPartition(presetId);
  const ses = session.fromPartition(partition);
  // resolve sessionConfig → setProxy on ses（逻辑复用 buildProxyRules）
}
```

在 `ProxySettings` 增加可选字段（向后兼容）：

```ts
// src/types/proxy-settings.ts
session?: { mode: ProxyMode; profileId?: string };
```

迁移时：若无 `session`，从 `tools` 里选出现次数最多的 mode/profile，写入 `session`。

GPS 同理：`GeolocationSettings.session?: { mode; profileId }`，apply 到 `getPresetPartition(presetId)`。

- [ ] **Step 1: 实现 store + migration**
- [ ] **Step 2: 单测 migration 纯函数（无 session 时从 tools 聚合）**
- [ ] **Step 3: Commit** `feat(preset): per-preset settings store and default migration`

---

### Task 4: 多窗口管理器

**Files:**
- Create: `electron/presetWindowManager.ts`
- Modify: `electron/main.ts`

**Interfaces:**
- Produces:
  - `openPresetWindow(presetId: string): Promise<BrowserWindow>`
  - `focusPresetWindow(presetId: string): boolean`
  - `closePresetWindow(presetId: string): void`
  - `getPresetWindow(presetId: string): BrowserWindow | null`
  - `getFocusedPresetId(): string | null`
  - `listOpenPresetIds(): string[]`

行为：

```ts
const windows = new Map<string, BrowserWindow>();

export async function openPresetWindow(presetId: string): Promise<BrowserWindow> {
  const existing = windows.get(presetId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }
  const meta = await getPreset(presetId);
  if (!meta) throw new Error(`Preset not found: ${presetId}`);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `AI Tool Box — ${meta.name}`,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      additionalArguments: [`--preset-id=${presetId}`],
    },
    // icon 等同现 createWindow
  });
  windows.set(presetId, win);
  win.on('closed', () => {
    if (windows.get(presetId) === win) windows.delete(presetId);
  });
  // loadURL / loadFile 同现 main.ts；query 可加 ?presetId= 作双保险
  return win;
}
```

- [ ] **Step 1: 实现 window manager**
- [ ] **Step 2: `main.ts` 启动改为 `await migrate…; await openPresetWindow('default')`；`activate` 时若无窗则开 default**
- [ ] **Step 3: 去掉单一 `mainWindow` 全局，或改为 `getFocusedPresetWindow()` 供 updater / image-gen 使用**
- [ ] **Step 4: Commit** `feat(preset): chrome-like one-window-per-preset manager`

---

### Task 5: Preload / IPC / 渲染拿到 presetId

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/electron-api.d.ts`
- Create: `src/hooks/usePresetContext.ts`
- Modify: `src/App.tsx` 或 `src/main.tsx`（Provider）

**Interfaces:**
- Produces `electronAPI`:
  - `getPresetId(): string`
  - `listPresets()`
  - `createPreset(name: string)`
  - `renamePreset(id, name)`
  - `deletePreset(id)`
  - `openPreset(id)` — 调主进程 open/focus
  - `listOpenPresets(): Promise<string[]>`
  - `getProxySettings` / `saveProxySettings` / geo / clearData：**增加或改为基于当前窗 presetId**（从 `event.sender` 反查 window → presetId，避免渲染伪造）

从 `process.argv` 解析 `--preset-id=`：

```ts
function readPresetIdFromArgv(): string {
  const arg = process.argv.find((a) => a.startsWith('--preset-id='));
  return arg?.slice('--preset-id='.length) || DEFAULT_PRESET_ID;
}
```

`usePresetContext`:

```ts
export function usePresetId(): string {
  return window.electronAPI?.getPresetId?.() ?? DEFAULT_PRESET_ID;
}
```

- [ ] **Step 1: IPC handlers in main**
- [ ] **Step 2: preload + d.ts**
- [ ] **Step 3: React hook / context**
- [ ] **Step 4: Commit** `feat(preset): expose preset IPC and renderer context`

---

### Task 6: 渲染侧设置键按 Preset 隔离

**Files:**
- Modify: `src/utils/settingsStorage.ts`
- Modify: `src/hooks/useToolSettings.ts`
- Modify: `src/hooks/useProxySettings.ts`
- Modify: `src/hooks/useGeolocationSettings.ts`
- Modify: `src/hooks/useSelectedTools.ts`
- Modify: `src/components/MultiWebviewTool.tsx`（传入 scoped keys）

**Interfaces:**
- Produces:

```ts
export function presetStorageKey(base: string, presetId: string): string {
  return `${base}::${presetId}`;
}
```

- `SELECTED_*` / `TOOL_SETTINGS` / 本地镜像的 proxy/geo 均用 `presetStorageKey`
- hooks 从 `usePresetId()` 取 id；保存时走主进程 `save*Settings`（已绑定 sender preset）
- 首次读：若新键空且 `presetId===default`，可读旧无后缀键一次并写入新键（配置迁移，与主进程 migration 对齐）

- [ ] **Step 1: 改 storage helper + hooks**
- [ ] **Step 2: `pnpm type-check` 通过**
- [ ] **Step 3: Commit** `feat(preset): scope renderer settings keys by presetId`

---

### Task 7: Webview / 自动化改用 Preset partition

**Files:**
- Modify: `src/components/MultiWebviewGrid.tsx`
- Modify: `src/components/ApiWebviewPage.tsx`
- Modify: `src/components/WebviewInputHandler.ts`
- Modify: `electron/webviewSession.ts` → `clearPresetWebviewData(presetId)`
- Modify: `electron/webviewExtract.ts`, `webviewExtractImages.ts`, `webviewReset.ts`
- Modify: `electron/imageGenService.ts`, `geminiImageCreator.ts`, `imageGenDebug.ts`, `bingImageCreator.ts`（找 webview 时用 focused preset 的 partition）
- Modify: 清缓存按钮文案 →「清理当前 Preset 缓存」；确认框说明影响本 Preset 所有站点

**关键逻辑：**

```ts
// MultiWebviewGrid
partition={getPresetPartition(presetId)}

// imageGenService 找 webview
const presetId = getFocusedPresetId() ?? DEFAULT_PRESET_ID;
findToolWebContents(getPresetPartition(presetId), …)
```

`clearToolWebviewData(toolId)` API 改为 `clearPresetWebviewData()`（无参，用 sender 窗的 preset），或保留形参忽略。

- [ ] **Step 1: 全局替换 partition 来源**
- [ ] **Step 2: `pnpm type-check`**
- [ ] **Step 3: Commit** `feat(preset): share webview session per preset partition`

---

### Task 8: UI — Preset 切换器与管理页

**Files:**
- Create: `src/components/PresetSwitcher/PresetSwitcher.tsx`
- Create: `src/components/PresetSwitcher/PresetSwitcher.module.css`
- Create: `src/components/PresetSettings/PresetSettingsPanel.tsx`
- Modify: `src/components/Sidebar.tsx`（header 下放切换器）
- Modify: `src/components/settings/SettingsPage.tsx`（新分组「工作区」→ Preset 管理）
- Modify: `src/components/ToolSettings/ToolSettingsPanel.tsx` — **去掉每站代理/GPS 列**（或禁用并提示「请到运行环境按 Preset 配置」）；启用开关仍按 Preset 存
- Modify: `src/components/EnvironmentSettings/ProxySettingsPanel.tsx` / `GeolocationSettingsPanel.tsx` — 编辑当前 Preset 的 `session` 上游 + profiles；Proxy 面板增加简短说明：「同一 Preset 共用一个上游；按网站分流请在 Clash 等本机代理中配置规则」

**切换器行为：**
- 展示当前 Preset 名
- 下拉：其他 Preset → `openPreset(id)`；「新建…」prompt 名称后 `createPreset` + `openPreset`；「管理…」→ `onPageChange('settings')` 并深链 tab=`presets`（可用 `sessionStorage` 或自定义事件）

**管理页：**
- 列表、重命名、删除（非 default）；显示是否 `listOpenPresets` 含该 id
- 删除前：若打开则 `closePresetWindow`；再 `deletePresetSettings` + registry 删除 + `clearPresetWebviewData`

新建：`createPreset(name)` 内调用 `copyPresetSettings('default', newId)`（仅配置）。

- [ ] **Step 1: PresetSwitcher**
- [ ] **Step 2: PresetSettingsPanel + Settings nav**
- [ ] **Step 3: 简化 ToolSettings 代理/GPS 列；环境面板改为 session 级**
- [ ] **Step 4: 窗口 title 随 rename 更新（IPC `presets:renamed` 广播或 open 时已设；rename 时 `win.setTitle`）**
- [ ] **Step 5: Commit** `feat(preset): add switcher and settings management UI`

---

### Task 9: 手动验收与文档

**Files:**
- Modify: `docs/superpowers/specs/2026-07-20-preset-workspaces-design.md`（状态改为「已实现」或保留；补「升级需重登」说明）
- Modify: `README.md`（若有设置说明则补一句 Preset）

**验收清单（手工）：**

- [ ] 启动只有 Default 窗，标题含「默认」
- [ ] 新建「工作」→ 新窗口；Default 仍在
- [ ] 再选「工作」→ 聚焦，不第二开
- [ ] 两窗登录不同账号互不影响
- [ ] 同窗内 Gemini 对话与生图共享登录
- [ ] 改「工作」代理不影响 Default
- [ ] 清缓存只清当前 Preset
- [ ] 删除「工作」后无法再打开；Cookie 失效
- [ ] `pnpm type-check` / `pnpm test` 通过

- [ ] **Step 1: 跑验收并修缺陷**
- [ ] **Step 2: Commit** `docs: note preset workspaces and re-login on upgrade`

---

## Spec Coverage Check

| Spec 项 | Task |
|---------|------|
| Default + 可增删改命名 | 2, 8 |
| 每 Preset 工具/勾选/代理/GPS/登录 | 3, 6, 7, 8 |
| 新开窗 / 一预设一窗 | 4, 5, 8 |
| `persist:preset-*` 共享 | 1, 7 |
| 清缓存按 Preset | 7 |
| 配置迁入 Default、Cookie 不迁 | 3, 6 |
| 全局 LLM/API/主题 | 不改 |
| 生图 API 不串 Preset | 7（focused preset） |

## 实现备注

- Task 1 故意让 `getToolPartition` 抛错，迫使 Task 7 清掉所有旧调用；若编译顺序导致中途无法 type-check，可临时让 `getToolPartition` 转发到 `getPresetPartition(DEFAULT_PRESET_ID)` 并在 Task 7 删除。
- 多窗时 `initializeProxySettings` 应对 **每个已打开 preset**（或延迟到 `openPresetWindow` 时 apply）。

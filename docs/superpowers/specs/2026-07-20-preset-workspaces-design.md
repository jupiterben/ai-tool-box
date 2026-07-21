# Preset 工作区设计

日期：2026-07-20  
状态：已确认（含代理路由修订）  

## 问题

各工具当前使用独立 Electron partition（`persist:tool-{toolId}`），登录态互不共享，且无法像 Chrome 多用户那样隔离「工作 / 个人」整套环境。用户需要可命名的工作区（Preset），并支持多窗口并行。

## 目标

- 内置 **Default** Preset；所有工具默认落在该 Preset。
- 用户可 **新增 / 重命名 / 删除** 自定义 Preset。
- 每个 Preset 拥有尽量完整的独立配置与登录态。
- 切换 Preset 的行为类似 Chrome 多用户：**新开窗口**；同一 Preset **最多一个窗口**（已打开则聚焦）。

## 非目标（本版不做）

- 旧版 `persist:tool-*` Cookie 自动迁移进 Default（可作后续增强）。
- 主题、LLM、Agent CLI、生图 API 等应用级配置按 Preset 隔离。
- 同一 Preset 多窗口并行。
- 云同步 Preset。
- 应用内按站点/工具做 Electron 级分流（见下方「代理模型」）。
- 内置完整规则引擎（Clash 规则 UI 等）；分流交给用户本机/上游代理。

## 行为

### 生命周期

| 动作 | 行为 |
|------|------|
| 应用启动 | 打开 Default Preset 窗口 |
| 新建 Preset | 用户命名；启用工具列表默认 **拷贝 Default 当前启用集**；独立空登录分区 |
| 切换到未打开的 Preset | 新建 `BrowserWindow`，注入该 `presetId` |
| 切换到已打开的 Preset | `focus()` 已有窗口，不第二开 |
| 重命名 | 仅改显示名；`id` 与 partition 不变 |
| 删除自定义 Preset | Default 不可删；若窗口开着则先关闭；清除该 Preset 持久化设置与 `persist:preset-{id}` |
| 清缓存 | 仅清除当前窗口 Preset 的 session 分区 |

### 窗口

- 标题：`AI Tool Box — {Preset 显示名}`
- 主进程维护 `Map<presetId, BrowserWindow>`，关闭窗口时从 map 移除。
- 渲染进程通过 preload / 启动参数获知当前 `presetId`。

## 数据模型

### Preset 元数据（应用级）

```ts
interface PresetMeta {
  id: string;          // 'default' | 'preset-<uuid>'
  name: string;        // 显示名；default 建议「默认」
  createdAt: number;
  order?: number;
}

interface PresetRegistry {
  version: string;
  presets: PresetMeta[];
  // 不存「当前全局 Preset」：以各窗口自身 presetId 为准
}
```

### 每个 Preset 自带的设置（按 presetId 分文件或分命名空间）

- 工具启用列表（可添加/移除应用）
- 对话 / 生图 / 生视频各自「当前勾选」工具
- **一份**上游代理（直连 / 系统 / 指定 profile，常见为本机 Clash 等端口）
- **一份**地理位置设置
- Webview 登录态：分区名 `persist:preset-{presetId}`（**同 Preset 内所有工具共享 Cookie**）

### 代理模型（修订）

同 Preset 共享一个 Chromium `session`，因此只能 `setProxy` **一次**：

```
Preset 内全部 webview
    → 唯一上游（如 127.0.0.1:7890）
    → 本机/上游代理按域名规则分流
```

- **应用负责：** Preset 级选一个上游（可推荐「系统代理」或本机 HTTP/SOCKS profile）。
- **分流负责方：** Clash / sing-box / 系统代理等；不同站不同出口在规则里配，不在 Tool 列表里每站选代理。
- **本版不做：** 应用内按 toolId 挂不同 Electron proxy；不做内置规则编辑器。

### 仍为全局

- LLM 摘要、Agent CLI、生图 API、主题等
- 代理 **profile 定义** 可仍放在设置里复用；**选用哪个上游** 按 Preset

### Partition 规则

- 现：`persist:tool-{toolId}`
- 新：`persist:preset-{presetId}`
- 代理 / GPS / `clearToolWebviewData` 均改为按 **preset 分区** 操作（不再按 tool 分区）。清缓存 UI 文案改为「清理当前 Preset 缓存」。
- 工具设置页 **去掉每站代理列**；改在运行环境 / Preset 环境中配置「本 Preset 上游」。

## UI

### 主界面 Preset 切换器

- 位置：顶栏或侧栏（实现时贴合现有布局）。
- 内容：当前 Preset 名；下拉列出全部 Preset、「新建…」、「管理…」。
- 「管理…」打开设置页 Preset 管理段。

### 设置页 — Preset 管理

- 列表：名称、是否打开中、重命名、删除（Default 无删除）。
- 新建表单：名称必填。

### 每窗口内设置

- 工具 / 代理 / GPS / 勾选工具：读写 **本窗口 presetId** 对应数据；互不影响。

## 架构要点

```
主进程
  ├─ PresetRegistry（增删改元数据）
  ├─ WindowManager: presetId → BrowserWindow（一预设一窗）
  └─ session.fromPartition(`persist:preset-${id}`)

渲染进程（每窗）
  ├─ 读取 window.presetId
  ├─ getPresetPartition(presetId) → webview.partition
  └─ 设置 hooks 以 presetId 为存储键
```

- `getToolPartition(toolId)` 演进为 `getPresetPartition(presetId)`（或保留兼容包装但内部忽略 toolId）。
- 生图 API / 自动化找 webview：需带 `presetId` 或在「当前聚焦窗口」的 partition 上解析；多窗并存时不得串用其他 Preset 的登录态。

## 迁移

1. 首次升级创建 Default Preset，把现有全局工具启用、代理、GPS、勾选工具 **归入 Default**（配置迁移）。
2. Cookie：**不**自动从 `persist:tool-*` 合并；用户在 Default 下重新登录一次。
3. 文档注明：升级后需重登各站（仅一次）。

## 成功标准

- 可新建命名 Preset，并新开独立窗口。
- 同 Preset 再次切换会聚焦已有窗口。
- 两 Preset 窗口同时打开时，登录态与代理互不影响。
- 同 Preset 内 Gemini 对话与 Gemini 生图共享登录。
- 删除自定义 Preset 后其 Cookie 与设置不可再访问。

## 已定决策摘要

| 项 | 决定 |
|----|------|
| 模型 | Preset = 完整工作区（非仅 Cookie） |
| 切换 | Chrome 式新开窗口 |
| 窗口数 | 每 Preset 最多一窗 |
| 设置范围 | 工具列表、勾选、上游代理、GPS、登录态 |
| 代理 | Preset 一份上游；域名分流交给本机/上游代理 |
| 新建默认 | 拷贝 Default 启用工具 |
| 旧 Cookie | 不自动迁移 |

# Agent CLI 独立页设计

日期：2026-08-09  
状态：已实现  

## 目标

将设置页中的 Agent CLI 配置提升为侧栏一级页面，并以 Grid Card 形式就地编辑各 CLI。

## 行为

- 侧栏在「API」与「设置」之间新增「Agent CLI」（`agent-cli`，图标 `TerminalSquare`）。
- 设置页移除 `agents` tab。
- 页面：页头（标题、说明、刷新）+ 响应式卡片网格。
- 每张卡独立 draft / busy / message；字段含启用、模型、权限模式、Base URL、API Key、默认参数；操作含安装/升级、还原、保存。
- 继续使用现有 `listAgentClis` / `installAgentCli` / `saveAgentCliConfig`。

## 非目标

- 不改 IPC / 安装后端逻辑。
- 不在此页运行 Agent。
- 不按 Preset 隔离 Agent CLI 配置。

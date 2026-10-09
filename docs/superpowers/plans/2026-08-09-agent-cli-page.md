# Agent CLI 独立页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Agent CLI 配置从设置页拆成侧栏一级 Grid Card 页面。

**Architecture:** 新增 `AgentCliPage`（页头 + 网格）与 `AgentCliCard`（单 CLI 就地编辑）；`App.tsx` 注册顶层页；`SettingsPage` 移除 agents tab。IPC 不变。

**Tech Stack:** React、现有 UI 组件（Card/Button/Input/Select/Toggle）、CSS Modules、Electron IPC。

## Global Constraints

- 侧栏顺序：对话 / 生图 / 生视频 / API / Agent CLI / 设置
- 卡片就地编辑，每卡独立保存
- 不改 electron agent-cli 后端

---

### Task 1: Agent CLI 页面与卡片

**Files:**
- Create: `src/components/AgentCliSettings/AgentCliPage.tsx`
- Create: `src/components/AgentCliSettings/AgentCliCard.tsx`
- Create: `src/components/AgentCliSettings/AgentCliPage.module.css`
- Modify or remove: `AgentCliSettingsPanel.tsx` / `.module.css`（不再被设置引用）

- [x] 实现页头 + 网格列表 + 单卡就地编辑
- [x] 接线 list / install / save

### Task 2: 路由与设置清理

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`

- [x] 侧栏注册 `agent-cli` 并 KeepAlive 渲染
- [x] 设置页删除 agents tab

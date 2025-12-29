# Data Model: 统一输入多 Webview 页面

**Created**: 2025-01-27  
**Feature**: 统一输入多 Webview 页面

## Overview

本功能主要涉及前端 UI 状态和输入传递状态管理。主要数据包括统一输入内容、工具选中状态、输入传递状态等。

## Entities

### UnifiedInputState (统一输入状态)

**描述**: 统一输入框的状态。

**字段**:
- `content: string` - 输入框内容
- `isSending: boolean` - 是否正在发送
- `characterCount: number` - 字符计数（可选）

**状态转换**:
```
初始状态: { content: "", isSending: false }
    ↓
用户输入: { content: "用户输入的内容", isSending: false }
    ↓
发送中: { content: "用户输入的内容", isSending: true }
    ↓
发送完成: { content: "", isSending: false }
```

### ToolSelectionState (工具选择状态)

**描述**: 用户选择的要显示的 AI 工具。

**字段**:
- `selectedToolIds: string[]` - 选中的工具 ID 列表
- `availableTools: AITool[]` - 所有可用工具（来自配置）

**状态转换**:
```
初始状态: { selectedToolIds: ["chatgpt", "deepseek"], availableTools: [...] }
    ↓
用户取消选择: { selectedToolIds: ["chatgpt"], availableTools: [...] }
    ↓
用户添加选择: { selectedToolIds: ["chatgpt", "deepseek", "claude"], availableTools: [...] }
```

### InputDeliveryState (输入传递状态)

**描述**: 输入内容传递到各个 webview 的状态。

**字段**:
- `toolId: string` - 工具 ID
- `status: "pending" | "sending" | "success" | "error"` - 传递状态
- `errorMessage?: string` - 错误信息（如有）
- `timestamp: number` - 时间戳

**状态转换**:
```
初始状态: { toolId: "chatgpt", status: "pending", timestamp: 0 }
    ↓
开始传递: { toolId: "chatgpt", status: "sending", timestamp: Date.now() }
    ↓
传递成功: { toolId: "chatgpt", status: "success", timestamp: Date.now() }
    ↓
传递失败: { toolId: "chatgpt", status: "error", errorMessage: "输入框未找到", timestamp: Date.now() }
```

### WebviewInputSelector (Webview 输入框选择器配置)

**描述**: 每个 AI 工具页面的输入框选择器配置。

**字段**:
- `toolId: string` - 工具 ID
- `selectors: string[]` - CSS 选择器列表（按优先级排序）
- `inputType: "textarea" | "input" | "contenteditable"` - 输入框类型
- `sendButtonSelector?: string` - 发送按钮选择器（可选）
- `sendMethod: "click" | "enter" | "submit"` - 发送方式

**示例**:
```typescript
{
  toolId: "chatgpt",
  selectors: [
    "textarea[placeholder*='Message']",
    "textarea",
    "div[contenteditable='true']"
  ],
  inputType: "textarea",
  sendButtonSelector: "button[type='submit']",
  sendMethod: "click"
}
```

## Data Structures

### AppState (应用状态)

**类型**: 组合状态

**用途**: React 组件中的整体状态管理。

**结构**:
```typescript
interface AppState {
  // 统一输入状态
  input: UnifiedInputState;
  
  // 工具选择状态
  toolSelection: ToolSelectionState;
  
  // 输入传递状态（每个工具一个）
  deliveryStates: Record<string, InputDeliveryState>;
  
  // 输入历史（当前会话）
  inputHistory: string[];
}
```

### InputHistoryItem (输入历史项)

**类型**: `string[]`

**用途**: 存储当前会话的输入历史（不持久化）。

**限制**:
- 最多存储最近 50 条输入
- 仅在当前会话有效
- 应用关闭后清除

## Validation Rules

1. **输入内容验证**
   - `content` 长度 <= 1000 字符
   - `content` 不能为空字符串（发送前）
   - `content` 去除首尾空格后不能为空

2. **工具选择验证**
   - `selectedToolIds` 不能为空数组（至少选择一个工具）
   - `selectedToolIds` 中的每个 ID 必须存在于 `availableTools` 中
   - `selectedToolIds` 长度 <= 4（最多同时显示 4 个）

3. **输入传递状态验证**
   - `status` 必须是有效的状态值
   - `errorMessage` 仅在 `status === "error"` 时存在
   - `timestamp` 必须是非负数

## Component Props Interfaces

### UnifiedInputProps

```typescript
interface UnifiedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  isSending?: boolean;
  maxLength?: number;
}
```

### ToolSelectorProps

```typescript
interface ToolSelectorProps {
  tools: AITool[];
  selectedToolIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}
```

### MultiWebviewGridProps

```typescript
interface MultiWebviewGridProps {
  tools: AITool[];
  selectedToolIds: string[];
  deliveryStates: Record<string, InputDeliveryState>;
  onRetry?: (toolId: string) => void;
}
```

### WebviewInputHandlerConfig

```typescript
interface WebviewInputHandlerConfig {
  toolId: string;
  webviewElement: HTMLElement; // webview 元素
  inputContent: string;
  selectors: WebviewInputSelector;
  timeout?: number; // 超时时间（毫秒）
}
```

## State Management Flow

```
用户输入
    ↓
UnifiedInputState.content 更新
    ↓
用户点击发送
    ↓
UnifiedInputState.isSending = true
    ↓
遍历 ToolSelectionState.selectedToolIds
    ↓
为每个工具创建 InputDeliveryState (status: "sending")
    ↓
并行执行 WebviewInputHandler
    ↓
更新每个工具的 InputDeliveryState (status: "success" | "error")
    ↓
UnifiedInputState.isSending = false
UnifiedInputState.content = ""
    ↓
将输入添加到 inputHistory
```

## Notes

- 所有状态都在内存中管理，不涉及持久化存储
- 输入历史仅在当前会话有效
- 输入传递状态在每次新输入时重置
- 工具选择状态在应用重启时恢复为默认值（所有工具选中）

# Component Interfaces: 统一输入多 Webview 页面

**Created**: 2025-01-27  
**Feature**: 统一输入多 Webview 页面

## Overview

本文档定义 React 组件的 TypeScript 接口规范。由于这是纯前端应用，不涉及后端 API，因此主要定义组件间的接口契约。

## Component Interfaces

### UnifiedInputProps

统一输入框组件的属性接口。

```typescript
interface UnifiedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  isSending?: boolean;
  maxLength?: number;
  placeholder?: string;
}
```

**约束**:
- `value`: 输入框的当前值
- `onChange`: 值改变时的回调函数
- `onSend`: 发送按钮点击或 Enter 键按下时的回调函数
- `isSending`: 是否正在发送（可选，用于禁用输入和显示加载状态）
- `maxLength`: 最大字符长度（可选，默认 1000）
- `placeholder`: 占位符文本（可选）

**行为**:
- Enter 键触发 `onSend`（Shift+Enter 换行）
- 发送按钮点击触发 `onSend`
- `isSending` 为 true 时禁用输入和发送按钮

### ToolSelectorProps

工具选择器组件的属性接口。

```typescript
interface ToolSelectorProps {
  tools: AITool[];
  selectedToolIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}
```

**约束**:
- `tools`: 所有可用的 AI 工具列表
- `selectedToolIds`: 当前选中的工具 ID 数组
- `onSelectionChange`: 选择改变时的回调函数

**行为**:
- 显示所有工具的复选框
- 选中的工具对应的复选框被勾选
- 点击复选框时调用 `onSelectionChange` 更新选中状态
- 至少需要选中一个工具（如果尝试取消最后一个，应阻止）

### MultiWebviewGridProps

多 webview 网格布局组件的属性接口。

```typescript
interface MultiWebviewGridProps {
  tools: AITool[];
  selectedToolIds: string[];
  deliveryStates: Record<string, InputDeliveryState>;
  onRetry?: (toolId: string) => void;
}
```

**约束**:
- `tools`: 所有可用的 AI 工具列表
- `selectedToolIds`: 当前选中的工具 ID 数组（决定显示哪些 webview）
- `deliveryStates`: 每个工具的输入传递状态
- `onRetry`: 重试传递的回调函数（可选）

**行为**:
- 根据 `selectedToolIds` 显示对应的 webview
- 使用 CSS Grid 布局，根据选中数量动态调整网格
- 每个 webview 显示工具名称和状态指示器
- 如果传递失败，显示错误提示和重试按钮

### InputDeliveryState

输入传递状态接口。

```typescript
interface InputDeliveryState {
  toolId: string;
  status: "pending" | "sending" | "success" | "error";
  errorMessage?: string;
  timestamp: number;
}
```

**约束**:
- `toolId`: 工具 ID
- `status`: 传递状态
  - `pending`: 等待传递
  - `sending`: 正在传递
  - `success`: 传递成功
  - `error`: 传递失败
- `errorMessage`: 错误信息（仅在 `status === "error"` 时存在）
- `timestamp`: 时间戳（毫秒）

### WebviewInputHandlerConfig

Webview 输入处理器的配置接口。

```typescript
interface WebviewInputHandlerConfig {
  toolId: string;
  webviewElement: HTMLElement;
  inputContent: string;
  selectors: WebviewInputSelector;
  timeout?: number;
}
```

**约束**:
- `toolId`: 工具 ID
- `webviewElement`: webview DOM 元素
- `inputContent`: 要传递的输入内容
- `selectors`: 输入框选择器配置
- `timeout`: 超时时间（可选，默认 1000 毫秒）

### WebviewInputSelector

Webview 输入框选择器配置接口。

```typescript
interface WebviewInputSelector {
  toolId: string;
  selectors: string[];
  inputType: "textarea" | "input" | "contenteditable";
  sendButtonSelector?: string;
  sendMethod: "click" | "enter" | "submit";
}
```

**约束**:
- `toolId`: 工具 ID
- `selectors`: CSS 选择器列表（按优先级排序）
- `inputType`: 输入框类型
- `sendButtonSelector`: 发送按钮选择器（可选）
- `sendMethod`: 发送方式
  - `click`: 点击发送按钮
  - `enter`: 触发 Enter 键事件
  - `submit`: 触发表单提交事件

## Function Interfaces

### useWebviewInput Hook

Webview 输入处理的 Hook 接口。

```typescript
function useWebviewInput(
  selectedToolIds: string[],
  tools: AITool[]
): {
  deliveryStates: Record<string, InputDeliveryState>;
  sendInput: (content: string) => Promise<void>;
  retry: (toolId: string) => Promise<void>;
  clearStates: () => void;
}
```

**参数**:
- `selectedToolIds`: 选中的工具 ID 数组
- `tools`: 所有可用工具列表

**返回值**:
- `deliveryStates`: 每个工具的传递状态
- `sendInput`: 发送输入到所有选中的 webview
- `retry`: 重试特定工具的输入传递
- `clearStates`: 清除所有传递状态

**行为**:
- `sendInput` 并行向所有选中的 webview 传递输入
- 每个 webview 的传递状态独立管理
- `retry` 只重试特定工具的传递，不影响其他工具

## Event Handlers

### onSend

统一输入框的发送事件处理器。

```typescript
type SendHandler = (content: string) => void;
```

**调用时机**: 用户点击发送按钮或按 Enter 键时

**参数**:
- `content: string` - 输入框的内容（已去除首尾空格）

**预期行为**:
- 验证内容不为空
- 调用输入传递逻辑
- 清空输入框（传递成功后）

### onSelectionChange

工具选择改变事件处理器。

```typescript
type SelectionChangeHandler = (selectedIds: string[]) => void;
```

**调用时机**: 用户勾选或取消勾选工具时

**参数**:
- `selectedIds: string[]` - 新的选中工具 ID 数组

**预期行为**:
- 更新工具选择状态
- 更新 webview 显示/隐藏
- 如果选中数量为 0，阻止操作并提示用户

### onRetry

重试输入传递事件处理器。

```typescript
type RetryHandler = (toolId: string) => void;
```

**调用时机**: 用户点击重试按钮时

**参数**:
- `toolId: string` - 要重试的工具 ID

**预期行为**:
- 重新执行该工具的输入传递
- 更新传递状态
- 如果再次失败，显示错误信息

## Constants

### Default Input Selectors

默认的输入框选择器配置。

```typescript
const DEFAULT_INPUT_SELECTORS: Record<string, WebviewInputSelector> = {
  chatgpt: {
    toolId: "chatgpt",
    selectors: [
      "textarea[placeholder*='Message']",
      "textarea",
      "div[contenteditable='true']"
    ],
    inputType: "textarea",
    sendButtonSelector: "button[type='submit']",
    sendMethod: "click"
  },
  deepseek: {
    toolId: "deepseek",
    selectors: [
      "textarea",
      "input[type='text']",
      "div[contenteditable='true']"
    ],
    inputType: "textarea",
    sendButtonSelector: "button",
    sendMethod: "click"
  }
};
```

## Validation Functions

### validateInputContent

验证输入内容。

```typescript
function validateInputContent(content: string, maxLength: number = 1000): {
  isValid: boolean;
  error?: string;
} {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "输入内容不能为空" };
  }
  if (content.length > maxLength) {
    return { isValid: false, error: `输入内容不能超过 ${maxLength} 字符` };
  }
  return { isValid: true };
}
```

### validateToolSelection

验证工具选择。

```typescript
function validateToolSelection(
  selectedIds: string[],
  availableTools: AITool[]
): {
  isValid: boolean;
  error?: string;
} {
  if (selectedIds.length === 0) {
    return { isValid: false, error: "至少需要选择一个工具" };
  }
  if (selectedIds.length > 4) {
    return { isValid: false, error: "最多只能同时选择 4 个工具" };
  }
  const invalidIds = selectedIds.filter(
    id => !availableTools.some(tool => tool.id === id)
  );
  if (invalidIds.length > 0) {
    return { isValid: false, error: `无效的工具 ID: ${invalidIds.join(", ")}` };
  }
  return { isValid: true };
}
```

## Notes

- 所有接口使用 TypeScript 定义，确保类型安全
- 组件应该遵循单一职责原则
- 接口设计保持最小化，仅包含必要属性
- 错误处理应该用户友好，避免技术术语
- 所有回调函数都应该处理错误情况

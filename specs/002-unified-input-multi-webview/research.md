# Research: 统一输入多 Webview 页面技术选型

**Created**: 2025-01-27  
**Feature**: 统一输入多 Webview 页面

## 技术决策

### Decision 1: 输入传递方式

**Decision**: 使用 JavaScript 注入直接操作 DOM（填充输入框并触发发送）

**Rationale**:
- **实现简单**: Electron webview 支持 `executeJavaScript` API，可以直接注入 JavaScript 代码操作页面 DOM
- **性能好**: 直接操作 DOM 比模拟键盘输入更快，响应时间更短
- **可靠性**: 虽然依赖页面结构，但可以通过多种选择器策略提高可靠性
- **符合最小化原则**: 不需要额外的 IPC 通信层，减少复杂度

**Alternatives Considered**:
- **Electron IPC 通信**: 需要每个 webview 都注入预加载脚本，实现复杂度高，且需要维护通信协议
- **模拟键盘输入**: 最接近真实用户操作，但性能较差，且可能触发意外的键盘事件处理

**Implementation Approach**:
1. 使用 Electron webview 的 `executeJavaScript` 方法注入脚本
2. 通过多种 CSS 选择器策略识别输入框（textarea、input[type="text"]、contenteditable div 等）
3. 填充内容后触发相应的事件（input、change）或直接调用发送函数
4. 如果识别失败，提供降级策略（显示错误提示）

### Decision 2: Webview 布局方式

**Decision**: 网格布局（2x2、1x2、2x1 等），支持响应式调整

**Rationale**:
- **同时对比**: 用户可以同时看到多个 AI 工具的回答，便于对比
- **灵活配置**: 支持不同的网格配置（1x2、2x1、2x2），适应不同屏幕尺寸
- **性能优化**: 可以通过懒加载和虚拟滚动优化性能
- **用户体验**: 符合用户期望的"多窗口对比"场景

**Alternatives Considered**:
- **标签页布局**: 节省空间但无法同时看到所有回答，不符合"同时显示多个 webview"的需求
- **分屏布局**: 只能同时显示 2-3 个工具，限制了灵活性

**Implementation Approach**:
1. 使用 CSS Grid 实现网格布局
2. 根据选中的工具数量动态调整网格配置
3. 支持响应式设计，在小屏幕上自动调整为单列布局
4. 每个 webview 显示工具名称和状态指示器

### Decision 3: 工具选择方式

**Decision**: 复选框列表，用户勾选要显示的工具

**Rationale**:
- **简单直观**: 复选框是最直观的多选控件，用户无需学习
- **快速操作**: 用户可以快速勾选/取消勾选多个工具
- **符合需求**: 满足"选择要显示的 webview"的需求，且实现简单
- **易于扩展**: 未来可以添加"全选"、"反选"等功能

**Alternatives Considered**:
- **下拉菜单**: 交互稍复杂，需要打开菜单，不符合快速切换的需求
- **拖拽排序**: 实现复杂度高，且当前场景不需要排序功能

**Implementation Approach**:
1. 在页面顶部或侧边栏显示工具列表
2. 每个工具显示复选框和名称
3. 勾选状态实时反映到 webview 显示/隐藏
4. 支持"全选"快捷操作（可选）

## Electron Webview JavaScript 注入最佳实践

### API 使用

```typescript
// 获取 webview 元素
const webview = document.querySelector('webview');

// 注入 JavaScript 代码
webview.executeJavaScript(`
  // 查找输入框
  const textarea = document.querySelector('textarea');
  if (textarea) {
    textarea.value = '${inputText}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }
`);
```

### 输入框识别策略

1. **主要策略**: 使用常见的 CSS 选择器
   - `textarea`
   - `input[type="text"]`
   - `div[contenteditable="true"]`
   - `.chat-input`, `.message-input` 等常见类名

2. **降级策略**: 如果主要策略失败，尝试：
   - 查找包含特定属性的元素（如 `placeholder` 包含"输入"、"message"等）
   - 查找最大尺寸的 textarea（通常是主输入框）

3. **发送按钮识别**:
   - 查找 `button[type="submit"]`
   - 查找包含发送图标的按钮
   - 触发 Enter 键事件作为备选

### 错误处理

- 如果输入框识别失败，返回错误信息
- 如果页面未加载完成，等待最多 5 秒后重试
- 提供重试机制，允许用户手动重试

## 性能优化策略

### Webview 加载优化

1. **懒加载**: 只加载当前选中的 webview，隐藏的 webview 不加载
2. **预加载**: 在用户选择工具前，预加载常用的 webview
3. **资源限制**: 限制每个 webview 的资源使用，避免内存溢出

### 输入传递优化

1. **并行执行**: 同时向所有 webview 传递输入，不串行等待
2. **超时控制**: 设置超时时间（1 秒），超时后显示错误
3. **状态缓存**: 缓存每个 webview 的输入框选择器，避免重复查找

### 内存管理

1. **Webview 生命周期**: 隐藏的 webview 可以暂停或销毁，需要时重新创建
2. **资源清理**: 定期清理不再使用的 webview 资源
3. **内存监控**: 监控内存使用，超过阈值时警告用户

## 兼容性考虑

### 不同 AI 工具页面结构

1. **ChatGPT**: 使用 `textarea` 作为输入框，有发送按钮
2. **DeepSeek**: 可能使用类似的 `textarea` 结构
3. **通用策略**: 支持多种选择器，适应不同的页面结构

### 页面更新应对

1. **选择器版本化**: 为每个 AI 工具维护多个版本的选择器
2. **自动检测**: 尝试多个选择器，找到可用的
3. **用户反馈**: 如果选择器失效，允许用户报告并更新

## 依赖清单

### 核心依赖
- `electron`: ^28.0.0 (已存在)
- `react`: ^18.2.0 (已存在)
- `react-dom`: ^18.2.0 (已存在)

### 无需额外依赖
- 使用 Electron 原生 webview API
- 使用 React 内置状态管理
- 使用原生 CSS Grid 布局

## 参考资料

- [Electron webview 文档](https://www.electronjs.org/docs/latest/api/webview-tag)
- [Electron executeJavaScript API](https://www.electronjs.org/docs/latest/api/webview-tag#webviewexecutejavascriptcode-usergesture)
- [CSS Grid 布局指南](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)

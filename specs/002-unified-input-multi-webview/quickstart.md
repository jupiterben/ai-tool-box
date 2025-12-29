# Quick Start Guide: 统一输入多 Webview 页面

**Created**: 2025-01-27  
**Feature**: 统一输入多 Webview 页面

## 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Git
- 已完成功能 001-ai-integration

## 快速开始

### 1. 确认依赖

确保项目已安装所有依赖：

```bash
pnpm install
```

### 2. 开发模式运行

```bash
# 启动开发服务器（React + Vite）
pnpm dev

# 在另一个终端启动 Electron
pnpm electron:dev
```

或者使用组合命令（如果配置了）：

```bash
pnpm dev:electron
```

### 3. 使用统一输入功能

1. **选择要显示的工具**
   - 在页面顶部或侧边栏找到工具选择器
   - 勾选要显示的 AI 工具（如 ChatGPT、DeepSeek）
   - 可以同时选择多个工具（最多 4 个）

2. **输入问题**
   - 在页面顶部的统一输入框中输入问题
   - 支持多行输入（Shift+Enter 换行）
   - 输入框显示字符计数（可选）

3. **发送输入**
   - 点击发送按钮或按 Enter 键
   - 输入内容会自动传递到所有选中的 webview
   - 每个 webview 的状态会实时显示（加载中、成功、失败）

4. **查看结果**
   - 在网格布局中同时查看所有 AI 工具的回答
   - 可以对比不同工具的回答
   - 如果某个工具传递失败，可以点击重试按钮

## 功能特性

### 统一输入框

- **多行输入**: 支持输入多行文本
- **快捷键**: Enter 发送，Shift+Enter 换行
- **字符限制**: 最多 1000 字符
- **发送状态**: 显示发送中状态，防止重复发送

### 工具选择

- **复选框选择**: 直观的多选界面
- **实时更新**: 选择后立即更新 webview 显示
- **数量限制**: 最多同时选择 4 个工具

### 多 Webview 布局

- **网格布局**: 自动调整网格配置（1x2、2x1、2x2 等）
- **响应式设计**: 适配不同屏幕尺寸
- **状态指示**: 每个 webview 显示加载状态和传递状态

### 输入传递

- **并行传递**: 同时向所有 webview 传递输入
- **自动识别**: 自动识别每个页面的输入框
- **错误处理**: 传递失败时显示错误提示和重试选项

## 配置输入框选择器

如果某个 AI 工具的输入框无法识别，可以更新选择器配置：

编辑 `src/utils/inputSelectors.ts`:

```typescript
export const INPUT_SELECTORS: Record<string, WebviewInputSelector> = {
  chatgpt: {
    toolId: "chatgpt",
    selectors: [
      "textarea[placeholder*='Message']",  // 主要选择器
      "textarea",                           // 降级选择器
      "div[contenteditable='true']"         // 最后的选择器
    ],
    inputType: "textarea",
    sendButtonSelector: "button[type='submit']",
    sendMethod: "click"
  },
  // 添加其他工具的配置...
};
```

## 常见问题

### Q: 输入无法传递到某个 webview

**A**: 可能的原因：
1. 页面结构变化导致选择器失效
2. 页面未加载完成
3. 输入框被禁用（需要登录）

**解决方案**:
1. 检查浏览器控制台的错误信息
2. 更新 `inputSelectors.ts` 中的选择器配置
3. 确保页面已完全加载
4. 检查是否需要登录

### Q: 多个 webview 加载很慢

**A**: 优化建议：
1. 减少同时显示的工具数量
2. 使用懒加载（只加载显示的 webview）
3. 检查网络连接
4. 关闭不必要的浏览器扩展

### Q: 输入传递超时

**A**: 可能的原因：
1. 网络延迟
2. 页面响应慢
3. 选择器无法找到输入框

**解决方案**:
1. 检查网络连接
2. 点击重试按钮
3. 更新选择器配置
4. 检查页面是否正常加载

### Q: 如何添加新的 AI 工具？

**A**: 步骤：
1. 在 `src/config/tools.ts` 中添加工具配置
2. 在 `src/utils/inputSelectors.ts` 中添加输入框选择器配置
3. 测试输入传递功能
4. 根据需要调整选择器

## 开发工作流

1. **修改代码**: 编辑 `src/` 目录下的文件
2. **热重载**: Vite 会自动检测变化并重新加载
3. **Electron 重载**: Electron 窗口会自动刷新（如配置了）
4. **测试功能**: 在 Electron 窗口中测试统一输入功能

## 调试技巧

### 查看 Webview 控制台

1. 右键点击 webview
2. 选择"检查元素"
3. 在 DevTools 中查看控制台输出

### 调试输入传递

1. 打开浏览器控制台（Electron DevTools）
2. 查看 `useWebviewInput` Hook 的日志输出
3. 检查 `WebviewInputHandler` 的执行结果

### 测试选择器

在浏览器控制台中执行：

```javascript
// 测试选择器是否有效
const selector = "textarea[placeholder*='Message']";
const element = document.querySelector(selector);
console.log("找到元素:", element);

// 测试填充内容
if (element) {
  element.value = "测试内容";
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
```

## 下一步

- 查看 [plan.md](./plan.md) 了解详细实现计划
- 查看 [spec.md](./spec.md) 了解功能规范
- 开始开发任务，参考 [tasks.md](./tasks.md)（如已创建）

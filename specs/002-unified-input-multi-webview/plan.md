# Implementation Plan: 统一输入多 Webview 页面

## Constitution Check

本计划遵循项目宪法原则：
- ✅ Minimal Dependencies: 仅使用 Electron 原生 webview API，不引入额外的输入管理库
- ✅ Modern Standards: 使用 React 18、TypeScript、CSS Grid 布局
- ✅ Code Quality: 组件化设计，单一职责，代码简洁清晰
- ✅ Performance First: 优化多 webview 同时加载的性能，使用懒加载和并行处理

## Overview

本计划实现统一输入多 webview 页面功能，扩展现有的 AI 工具集成页面。主要功能包括：
1. 统一的 AI 对话输入框
2. 同时显示多个 webview（网格布局）
3. 输入内容自动传递到所有显示的 webview

## Goals

1. **功能目标**
   - 实现统一输入框组件
   - 实现多 webview 网格布局
   - 实现输入内容传递机制
   - 实现工具选择功能

2. **技术目标**
   - 最小化依赖，使用 Electron 原生 API
   - 优化多 webview 性能
   - 支持多种 AI 工具页面结构

3. **质量目标**
   - 代码简洁清晰，易于维护
   - 符合项目宪法原则
   - 满足规范中的成功标准

## Technical Context

### Technology Stack

- **前端框架**: React 18 (已存在)
- **构建工具**: Vite 5 (已存在)
- **桌面框架**: Electron 28 (已存在)
- **包管理**: pnpm (已存在)
- **语言**: TypeScript (已存在)
- **样式**: CSS Modules + CSS Grid (已存在)

### Architecture

**应用架构**:
```
┌─────────────────────────────────────────┐
│      Electron Main Process               │
│  (窗口管理、应用生命周期)                 │
└──────────────┬──────────────────────────┘
               │ IPC
┌──────────────▼──────────────────────────┐
│    Electron Renderer Process            │
│  ┌──────────────────────────────────┐  │
│  │      React App                    │  │
│  │  ┌──────────────┐                │  │
│  │  │ UnifiedInput │                │  │
│  │  └──────┬───────┘                │  │
│  │         │                        │  │
│  │  ┌──────▼──────────────────┐   │  │
│  │  │ ToolSelector (Checkboxes)│   │  │
│  │  └──────┬──────────────────┘   │  │
│  │         │                        │  │
│  │  ┌──────▼──────────────────┐   │  │
│  │  │ MultiWebviewGrid         │   │  │
│  │  │ ┌────┐ ┌────┐            │   │  │
│  │  │ │WV1 │ │WV2 │            │   │  │
│  │  │ └────┘ └────┘            │   │  │
│  │  │ ┌────┐ ┌────┐            │   │  │
│  │  │ │WV3 │ │WV4 │            │   │  │
│  │  │ └────┘ └────┘            │   │  │
│  │  └──────────────────────────┘   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**目录结构**:
```
ai-tool-box/
├── src/
│   ├── components/
│   │   ├── UnifiedInput.tsx          # 统一输入框组件
│   │   ├── UnifiedInput.module.css
│   │   ├── ToolSelector.tsx          # 工具选择器（复选框）
│   │   ├── ToolSelector.module.css
│   │   ├── MultiWebviewGrid.tsx      # 多 webview 网格布局
│   │   ├── MultiWebviewGrid.module.css
│   │   ├── WebviewInputHandler.ts    # Webview 输入处理工具
│   │   └── AIFrame.tsx               # 现有组件（扩展）
│   ├── hooks/
│   │   └── useWebviewInput.ts        # Webview 输入处理 Hook
│   ├── utils/
│   │   └── inputSelectors.ts         # 输入框选择器配置
│   ├── App.tsx                        # 主应用组件（更新）
│   └── styles/
│       └── App.module.css             # 样式（更新）
├── electron/
│   └── main.ts                        # 主进程（无需修改）
└── ...
```

### Key Components

1. **UnifiedInput.tsx**: 统一输入框组件
   - 文本输入（支持多行）
   - 发送按钮
   - Enter 发送，Shift+Enter 换行
   - 字符计数（可选）

2. **ToolSelector.tsx**: 工具选择器组件
   - 复选框列表
   - 显示所有可用工具
   - 实时更新 webview 显示状态

3. **MultiWebviewGrid.tsx**: 多 webview 网格布局组件
   - CSS Grid 布局
   - 动态网格配置（根据选中工具数量）
   - 响应式设计

4. **WebviewInputHandler.ts**: Webview 输入处理工具
   - JavaScript 注入逻辑
   - 输入框识别策略
   - 错误处理

5. **useWebviewInput.ts**: Webview 输入处理 Hook
   - 封装输入传递逻辑
   - 状态管理（成功/失败/进行中）
   - 重试机制

### State Management

使用 React 内置状态管理：
- `useState`: 管理输入内容、选中的工具、传递状态等
- `useCallback`: 优化回调函数
- `useMemo`: 缓存计算结果
- `useRef`: 引用 webview 元素

### Data Flow

```
用户输入
    ↓
UnifiedInput 组件
    ↓
App 组件（状态管理）
    ↓
useWebviewInput Hook
    ↓
WebviewInputHandler（JavaScript 注入）
    ↓
各个 Webview（并行执行）
    ↓
状态反馈（成功/失败）
```

## Approach

### Phase 1: 统一输入框组件

1. **创建 UnifiedInput 组件**
   - 实现文本输入框（textarea）
   - 实现发送按钮
   - 实现键盘事件处理（Enter、Shift+Enter）
   - 添加基本样式

2. **集成到 App 组件**
   - 在页面顶部添加 UnifiedInput
   - 管理输入状态
   - 处理发送事件

### Phase 2: 工具选择器组件

1. **创建 ToolSelector 组件**
   - 显示所有可用工具（复选框）
   - 管理选中状态
   - 实时更新 webview 显示

2. **集成到 App 组件**
   - 在输入框下方添加 ToolSelector
   - 管理工具选中状态
   - 控制 webview 显示/隐藏

### Phase 3: 多 Webview 网格布局

1. **创建 MultiWebviewGrid 组件**
   - 实现 CSS Grid 布局
   - 根据选中工具数量动态调整网格
   - 响应式设计

2. **扩展 AIFrame 组件**
   - 添加状态指示器（加载中、成功、失败）
   - 添加工具名称显示
   - 支持显示/隐藏控制

3. **集成到 App 组件**
   - 替换现有的单个 webview 显示
   - 使用 MultiWebviewGrid 显示多个 webview

### Phase 4: 输入传递机制

1. **创建输入框选择器配置**
   - 为每个 AI 工具配置输入框选择器
   - 支持多种选择器策略
   - 支持降级策略

2. **创建 WebviewInputHandler 工具**
   - 实现 JavaScript 注入逻辑
   - 实现输入框识别
   - 实现内容填充和发送触发
   - 实现错误处理

3. **创建 useWebviewInput Hook**
   - 封装输入传递逻辑
   - 管理传递状态
   - 实现重试机制

4. **集成到 App 组件**
   - 连接 UnifiedInput 和 useWebviewInput
   - 处理传递结果
   - 显示状态反馈

### Phase 5: 优化和测试

1. **性能优化**
   - 优化多 webview 加载
   - 优化输入传递性能
   - 内存管理

2. **错误处理**
   - 完善错误提示
   - 实现重试机制
   - 处理边界情况

3. **测试**
   - 功能测试
   - 性能测试
   - 兼容性测试

## Timeline

- **Phase 1**: 1 天（统一输入框组件）
- **Phase 2**: 0.5 天（工具选择器）
- **Phase 3**: 1 天（多 webview 网格布局）
- **Phase 4**: 2 天（输入传递机制）
- **Phase 5**: 1 天（优化和测试）

**总计**: 5.5 天

## Risks & Mitigation

### Risk 1: 输入框识别失败

**风险**: AI 工具页面结构变化导致输入框选择器失效

**缓解措施**:
- 支持多种选择器策略
- 实现降级策略
- 提供用户反馈机制
- 定期更新选择器配置

### Risk 2: 多 Webview 性能问题

**风险**: 同时加载多个 webview 导致性能下降

**缓解措施**:
- 使用懒加载，只加载显示的 webview
- 优化 webview 资源使用
- 监控内存使用
- 提供性能警告

### Risk 3: 输入传递超时

**风险**: 某些 webview 响应慢导致传递超时

**缓解措施**:
- 设置合理的超时时间（1 秒）
- 实现并行传递，不等待慢的 webview
- 提供重试机制
- 显示详细的错误信息

### Risk 4: 页面结构差异

**风险**: 不同 AI 工具页面结构差异大，难以统一处理

**缓解措施**:
- 为每个工具配置专门的选择器
- 支持多种输入框类型（textarea、input、contenteditable）
- 实现通用的输入框识别策略
- 提供工具特定的处理逻辑

## Dependencies

### 内部依赖

- **001-ai-integration**: 
  - AIFrame 组件（需要扩展）
  - 工具配置（DEFAULT_TOOLS）
  - AITool 类型定义

### 外部依赖

- **Electron webview API**: 
  - `executeJavaScript` 方法
  - `did-finish-load` 事件
  - `did-fail-load` 事件

## Success Criteria Alignment

本计划确保满足规范中的成功标准：

1. **性能指标**
   - ✅ 页面加载时间 < 3 秒（通过懒加载优化）
   - ✅ 输入传递响应时间 < 1 秒（通过并行处理和优化）
   - ✅ 工具切换响应时间 < 500ms（通过状态管理优化）

2. **代码质量**
   - ✅ 最小化依赖（仅使用 Electron 原生 API）
   - ✅ 组件化设计，代码清晰
   - ✅ TypeScript 类型安全

3. **用户体验**
   - ✅ 界面直观，易于使用
   - ✅ 错误提示清晰
   - ✅ 支持快速切换工具

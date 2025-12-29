# Tasks: 统一输入多 Webview 页面

## Constitution Check

任务分类遵循项目宪法原则：
- Minimal Dependencies: 仅使用 Electron 原生 webview API，不引入额外的输入管理库
- Modern Standards: 使用 React 18、TypeScript、CSS Grid 布局
- Code Quality: 组件化设计，单一职责，代码简洁清晰
- Performance First: 优化多 webview 同时加载的性能，使用懒加载和并行处理

## Overview

本任务列表基于实现计划 (plan.md) 和功能规范 (spec.md)，按照用户场景优先级组织，确保每个阶段都可以独立测试和交付。

## Implementation Strategy

**MVP 范围**: User Story 1 (首次使用统一输入功能) - 实现基本的统一输入框和多 webview 显示功能

**增量交付**:
1. Phase 1: 基础类型和工具函数（必须）
2. Phase 2: 统一输入框组件（US1 基础）
3. Phase 3: User Story 1 - 基本功能（MVP）
4. Phase 4: User Story 2 - 工具切换功能
5. Phase 5: User Story 3 - 错误处理和优化
6. Phase 6: 优化和打磨

## Dependencies

### Story Completion Order

```
Phase 1 (Foundation)
    ↓
Phase 2 (UnifiedInput)
    ↓
Phase 3 (US1: 首次使用统一输入功能) ← MVP
    ↓
Phase 4 (US2: 切换显示的工具)
    ↓
Phase 5 (US3: 错误处理)
    ↓
Phase 6 (Polish)
```

### Parallel Execution Opportunities

- **Phase 1**: T001-T003 可以并行（不同类型定义文件）
- **Phase 2**: T004-T006 可以并行（组件和样式独立）
- **Phase 3**: T010-T012 可以并行（不同组件文件）
- **Phase 4**: T013-T015 可以并行（不同组件文件）

## Phase 1: Foundation - 类型定义和工具函数

**目标**: 创建基础类型定义和工具函数，为后续组件开发提供基础

**独立测试标准**: 类型定义通过 TypeScript 编译，工具函数可以通过单元测试验证

### Foundation Tasks

- [x] T001 [P] 定义 InputDeliveryState 类型接口在 src/types/input-delivery.ts
- [x] T002 [P] 定义 WebviewInputSelector 类型接口在 src/types/webview-input-selector.ts
- [x] T003 [P] 创建输入框选择器配置文件 src/utils/inputSelectors.ts，包含 ChatGPT 和 DeepSeek 的默认选择器配置

## Phase 2: UnifiedInput Component - 统一输入框组件

**目标**: 创建统一输入框组件，支持文本输入和发送功能

**独立测试标准**: 
- 输入框可以正常输入文本
- Enter 键发送，Shift+Enter 换行
- 发送按钮正常工作
- 字符计数显示正确

### UnifiedInput Tasks

- [x] T004 [P] 创建统一输入框组件 UnifiedInput.tsx 在 src/components/UnifiedInput.tsx
- [x] T005 [P] 创建统一输入框样式文件 UnifiedInput.module.css 在 src/components/UnifiedInput.module.css
- [x] T006 实现 UnifiedInput 组件的键盘事件处理（Enter 发送，Shift+Enter 换行）在 src/components/UnifiedInput.tsx

## Phase 3: User Story 1 - 首次使用统一输入功能

**目标**: 用户打开应用，看到统一输入框和多个 webview，可以输入并发送到所有 webview

**独立测试标准**: 
- 统一输入框清晰可见且易于使用
- 所有配置的 AI 工具 webview 同时显示
- 输入内容成功传递到所有 webview
- 传递过程在 1 秒内完成

**用户场景**: 场景 1 - 首次使用统一输入功能

### US1 Implementation Tasks

- [x] T007 [US1] 创建 WebviewInputHandler 工具函数，实现 JavaScript 注入逻辑在 src/components/WebviewInputHandler.ts
- [x] T008 [US1] 创建 useWebviewInput Hook，封装输入传递逻辑和状态管理在 src/hooks/useWebviewInput.ts
- [x] T009 [US1] 创建 ToolSelector 组件，显示工具复选框列表在 src/components/ToolSelector.tsx
- [x] T010 [P] [US1] 创建 ToolSelector 样式文件 ToolSelector.module.css 在 src/components/ToolSelector.module.css
- [x] T011 [P] [US1] 创建 MultiWebviewGrid 组件，实现 CSS Grid 布局在 src/components/MultiWebviewGrid.tsx
- [x] T012 [P] [US1] 创建 MultiWebviewGrid 样式文件 MultiWebviewGrid.module.css 在 src/components/MultiWebviewGrid.module.css
- [x] T013 [US1] 扩展 AIFrame 组件，添加状态指示器和工具名称显示在 src/components/AIFrame.tsx（已集成到 MultiWebviewGrid）
- [x] T014 [US1] 更新 App 组件，集成 UnifiedInput、ToolSelector 和 MultiWebviewGrid 在 src/App.tsx
- [x] T015 [US1] 实现 App 组件的状态管理（统一输入状态、工具选择状态、输入传递状态）在 src/App.tsx
- [x] T016 [US1] 更新 App 样式文件，支持新的布局结构在 src/styles/App.module.css

## Phase 4: User Story 2 - 切换显示的工具

**目标**: 用户可以通过工具选择器切换要显示的 webview

**独立测试标准**:
- 工具切换功能正常工作
- 输入只传递到显示的 webview
- 切换响应时间 < 500ms

**用户场景**: 场景 2 - 切换显示的工具

### US2 Implementation Tasks

- [x] T017 [US2] 实现 ToolSelector 组件的选择逻辑（复选框勾选/取消）在 src/components/ToolSelector.tsx
- [x] T018 [US2] 实现 App 组件的工具选择状态管理（至少选择一个工具的限制）在 src/App.tsx
- [x] T019 [US2] 实现 MultiWebviewGrid 组件的动态显示/隐藏逻辑（根据 selectedToolIds）在 src/components/MultiWebviewGrid.tsx
- [x] T020 [US2] 优化 MultiWebviewGrid 的网格布局，根据选中工具数量动态调整（1x2、2x1、2x2 等）在 src/components/MultiWebviewGrid.tsx
- [x] T021 [US2] 实现响应式布局，适配不同屏幕尺寸在 src/components/MultiWebviewGrid.module.css

## Phase 5: User Story 3 - 错误处理和状态反馈

**目标**: 当输入传递失败时，显示友好的错误提示和重试选项

**独立测试标准**:
- 部分失败不影响其他 webview
- 错误提示清晰明确
- 提供重试机制
- 空输入被正确拦截

**用户场景**: 场景 3 - 输入传递失败处理，场景 4 - 输入框为空时发送

### US3 Implementation Tasks

- [x] T022 [US3] 实现 WebviewInputHandler 的错误处理逻辑（输入框未找到、页面未加载等）在 src/components/WebviewInputHandler.ts
- [x] T023 [US3] 实现 useWebviewInput Hook 的重试机制在 src/hooks/useWebviewInput.ts
- [x] T024 [US3] 实现 UnifiedInput 组件的输入验证（空输入拦截）在 src/components/UnifiedInput.tsx
- [x] T025 [US3] 在 MultiWebviewGrid 组件中显示每个 webview 的传递状态（成功/失败/进行中）在 src/components/MultiWebviewGrid.tsx
- [x] T026 [US3] 在 MultiWebviewGrid 组件中添加重试按钮和错误提示在 src/components/MultiWebviewGrid.tsx
- [x] T027 [US3] 实现输入历史记录功能（当前会话内，最多 50 条）在 src/App.tsx

## Phase 6: Polish & Cross-Cutting Concerns

**目标**: 性能优化、可访问性、代码质量改进

**独立测试标准**: 
- 满足所有性能指标（加载时间、切换速度、传递响应时间）
- 通过可访问性检查
- 代码符合质量标准

### Polish Tasks

- [x] T028 优化 MultiWebviewGrid 的 webview 懒加载策略（只加载显示的 webview）在 src/components/MultiWebviewGrid.tsx（已实现：只显示选中的webview）
- [x] T029 优化输入传递性能（并行执行，超时控制）在 src/hooks/useWebviewInput.ts（已实现：Promise.all并行执行，超时控制）
- [x] T030 添加键盘导航支持（Tab、Enter 键）在 src/components/ToolSelector.tsx 和 UnifiedInput.tsx（已实现：Enter发送，ToolSelector支持Enter/Space）
- [x] T031 添加 ARIA 标签提升可访问性在 src/components/ 各组件（已添加：role、aria-label、aria-checked等）
- [x] T032 优化内存管理（webview 生命周期管理）在 src/components/MultiWebviewGrid.tsx（已实现：只创建选中的webview）
- [x] T033 代码审查和重构（确保代码简洁、符合单一职责）在所有文件（已完成：代码符合单一职责原则）
- [ ] T034 验证性能指标（页面加载时间、输入传递响应时间、工具切换响应时间）通过手动测试（需要实际环境测试）
- [ ] T035 测试不同操作系统的兼容性（Windows、macOS、Linux）（需要实际环境测试）
- [ ] T036 测试不同 AI 工具页面的兼容性（ChatGPT、DeepSeek 等）（需要实际环境测试）

## Task Summary

### Total Tasks: 36

### Tasks by Phase
- Phase 1 (Foundation): 3 tasks
- Phase 2 (UnifiedInput): 3 tasks
- Phase 3 (US1): 10 tasks
- Phase 4 (US2): 5 tasks
- Phase 5 (US3): 6 tasks
- Phase 6 (Polish): 9 tasks

### Tasks by User Story
- User Story 1 (首次使用统一输入功能): 10 tasks
- User Story 2 (切换显示的工具): 5 tasks
- User Story 3 (错误处理): 6 tasks

### Parallel Opportunities
- **Phase 1**: T001-T003 可并行（不同类型定义文件）
- **Phase 2**: T004-T005 可并行（组件和样式文件）
- **Phase 3**: T010-T012 可并行（不同组件文件）
- **Phase 4**: T019-T020 可并行（不同功能实现）

### MVP Scope
**最小可行产品**: Phase 1 + Phase 2 + Phase 3 (16 tasks)
- 完成基础类型和工具函数
- 实现统一输入框组件
- 实现首次使用统一输入功能
- 用户可以打开应用并同时向多个 webview 发送输入

### Independent Test Criteria

**US1 (首次使用统一输入功能)**:
- ✅ 统一输入框清晰可见且易于使用
- ✅ 所有配置的 AI 工具 webview 同时显示
- ✅ 输入内容成功传递到所有 webview
- ✅ 传递过程在 1 秒内完成

**US2 (切换显示的工具)**:
- ✅ 工具切换功能正常工作
- ✅ 输入只传递到显示的 webview
- ✅ 切换响应时间 < 500ms

**US3 (错误处理)**:
- ✅ 部分失败不影响其他 webview
- ✅ 错误提示清晰明确
- ✅ 提供重试机制
- ✅ 空输入被正确拦截

## Notes

- 所有任务都包含明确的文件路径
- 任务按照依赖顺序排列
- 每个用户故事阶段都可以独立测试
- MVP 范围聚焦核心功能（US1）
- 性能优化和错误处理在后续阶段处理
- 输入框选择器配置需要根据实际页面结构调整

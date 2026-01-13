# Prompt迭代拓展生成工具任务列表

## Constitution Check

任务分类遵循项目宪法原则：
- ✅ Minimal Dependencies: 使用零依赖方案（Node.js原生模块、React Context）
- ✅ Modern Standards: 使用现代Web标准和TypeScript
- ✅ Code Quality: 组件职责单一，类型完整
- ✅ Performance First: 异步处理，不阻塞UI

## 任务概览

**总任务数**: 88
**用户故事数**: 7 (P1: 5个, P2: 2个)
**并行任务数**: 26

### 任务分布

- **Phase 1 (Setup)**: 13个任务
- **Phase 2 (Foundational)**: 13个任务
- **Phase 3 (US1 - 输入初始需求)**: 6个任务
- **Phase 4 (US2 - AI生成拓展方向)**: 8个任务
- **Phase 5 (US3 - 选择拓展方向)**: 5个任务
- **Phase 6 (US4 - 迭代拓展过程)**: 7个任务
- **Phase 7 (US5 - 生成最终提示词)**: 12个任务
- **Phase 8 (US6 - 保存和导出)**: 8个任务
- **Phase 9 (US7 - 查看拓展历史)**: 6个任务
- **Phase 10 (Polish)**: 10个任务

## 依赖关系图

```
Phase 1 (Setup)
  ↓
Phase 2 (Foundational)
  ↓
Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5)
  ↓                                                                    ↓
Phase 8 (US6) ←────────────────────────────────────────────────────────┘
  ↓
Phase 9 (US7)
  ↓
Phase 10 (Polish)
```

**说明**:
- US1-US5 是核心流程，需要顺序完成
- US6 依赖 US5（需要最终提示词）
- US7 可以在 US4 完成后开始（需要历史记录）
- Polish 阶段在所有功能完成后进行

## 并行执行示例

### US1阶段可并行任务
- T019 [P] [US1] 创建InitialInput组件
- T020 [P] [US1] 创建InitialInput样式文件

### US2阶段可并行任务
- T025 [P] [US2] 实现AIService类的基础结构
- T026 [P] [US2] 实现generateExpansionOptions方法
- T027 [P] [US2] 实现错误处理和重试机制

### US3阶段可并行任务
- T033 [P] [US3] 创建ExpansionOptions组件
- T034 [P] [US3] 创建ExpansionOptions样式文件

## 实施策略

### MVP范围
**最小可行产品**: Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 (US1-US3)
- 用户可以输入初始需求
- AI生成拓展方向
- 用户选择拓展方向
- 基础迭代流程（1次迭代）

### 增量交付
1. **MVP**: 基础输入和选择功能
2. **迭代1**: 完整迭代流程（US4）
3. **迭代2**: 最终提示词生成（US5）
4. **迭代3**: 保存和导出（US6）
5. **迭代4**: 历史记录查看（US7）
6. **迭代5**: 优化和打磨（Polish）

## 任务列表

### Phase 1: Setup & Configuration

#### 项目结构初始化

- [X] T001 创建PromptExpander组件目录结构 `src/components/PromptExpander/`
- [X] T002 创建hooks目录下的新文件结构 `src/hooks/usePromptExpander.ts` 和 `src/hooks/useAIService.ts`
- [X] T003 创建services目录结构 `src/services/` (主进程)
- [X] T004 创建类型定义文件 `src/types/prompt-expander.ts`
- [X] T005 创建工具函数文件 `src/utils/promptFormatter.ts`

#### 类型定义

- [X] T006 [P] 在 `src/types/prompt-expander.ts` 中定义ExpansionOption接口
- [X] T007 [P] 在 `src/types/prompt-expander.ts` 中定义ExpansionStep接口
- [X] T008 [P] 在 `src/types/prompt-expander.ts` 中定义ExpansionHistory接口
- [X] T009 [P] 在 `src/types/prompt-expander.ts` 中定义FinalPrompt接口
- [X] T010 [P] 在 `src/types/prompt-expander.ts` 中定义PromptExpanderState接口
- [X] T011 [P] 在 `src/types/prompt-expander.ts` 中定义SavedPrompt接口
- [X] T012 [P] 在 `src/types/prompt-expander.ts` 中定义IPC请求/响应接口

#### 应用集成

- [X] T013 在 `src/config/tools.ts` 中添加prompt-expander工具配置

---

### Phase 2: Foundational Infrastructure

#### Electron IPC设置

- [X] T014 在 `electron/preload.ts` 中暴露electronAPI对象，包含invoke方法
- [X] T015 在 `electron/main.ts` 中注册IPC处理器 `ai:generate-expansion-options`
- [X] T016 在 `electron/main.ts` 中注册IPC处理器 `ai:generate-final-prompt`
- [X] T017 在 `electron/main.ts` 中注册IPC处理器 `storage:save-prompt`
- [X] T018 在 `electron/main.ts` 中注册IPC处理器 `export:save-prompt-file`

#### AI服务基础

- [X] T019 [P] 创建 `src/services/aiService.ts` 文件，实现AIService类基础结构
- [X] T020 [P] 在 `src/services/aiService.ts` 中实现API密钥管理（使用Electron safeStorage）
- [X] T021 [P] 在 `src/services/aiService.ts` 中实现HTTP请求封装（使用Node.js原生https模块）
- [X] T022 [P] 在 `src/services/aiService.ts` 中实现超时处理（30秒超时）

#### 存储服务基础

- [X] T023 [P] 创建 `src/services/storageService.ts` 文件，实现StorageService类
- [X] T024 [P] 在 `src/services/storageService.ts` 中实现存储路径管理（使用app.getPath('userData')）

#### Hook基础

- [X] T025 [P] 创建 `src/hooks/useAIService.ts`，实现AI服务调用Hook的基础结构
- [X] T026 [P] 在 `src/hooks/useAIService.ts` 中实现IPC通信封装

---

### Phase 3: User Story 1 - 输入初始需求

**目标**: 用户可以输入初始需求，开始提示词生成流程

**独立测试标准**:
- 用户可以输入10-2000字符的文本
- 输入验证正确（非空、长度检查）
- 提交按钮在输入有效时启用
- 显示字符计数
- 错误提示清晰

#### 组件实现

- [X] T027 [US1] 创建 `src/components/PromptExpander/InitialInput.tsx` 组件
- [X] T028 [US1] 创建 `src/components/PromptExpander/InitialInput.module.css` 样式文件
- [X] T029 [US1] 在InitialInput组件中实现多行文本输入框
- [X] T030 [US1] 在InitialInput组件中实现输入验证（10-2000字符）
- [X] T031 [US1] 在InitialInput组件中实现字符计数显示
- [X] T032 [US1] 在InitialInput组件中实现错误提示和提交按钮

---

### Phase 4: User Story 2 - AI生成拓展方向

**目标**: 系统能够使用AI生成3-5个拓展方向

**独立测试标准**:
- AI能够生成3-5个拓展方向
- 每个方向包含标题和描述
- 生成过程显示加载状态
- 生成失败时显示错误提示
- 支持重试功能

#### AI服务实现

- [X] T033 [US2] 在 `src/services/aiService.ts` 中实现generateExpansionOptions方法
- [X] T034 [US2] 在 `src/services/aiService.ts` 中实现拓展方向提示词构建逻辑
- [X] T035 [US2] 在 `src/services/aiService.ts` 中实现响应解析（解析为ExpansionOption数组）
- [X] T036 [US2] 在 `src/services/aiService.ts` 中实现重试机制（最多3次）

#### Hook实现

- [X] T037 [US2] 在 `src/hooks/useAIService.ts` 中实现generateExpansionOptions方法
- [X] T038 [US2] 在 `src/hooks/useAIService.ts` 中实现加载状态管理
- [X] T039 [US2] 在 `src/hooks/useAIService.ts` 中实现错误处理和重试逻辑

#### 主组件集成

- [X] T040 [US2] 在 `src/components/PromptExpander/PromptExpander.tsx` 中集成AI服务调用

---

### Phase 5: User Story 3 - 选择拓展方向

**目标**: 用户可以从AI生成的拓展方向中选择一个

**独立测试标准**:
- 所有拓展方向以卡片/列表形式展示
- 用户可以点击选择方向
- 选择状态有明确的视觉反馈
- 支持取消选择
- 确认按钮在选择后启用

#### 组件实现

- [X] T041 [US3] 创建 `src/components/PromptExpander/ExpansionOptions.tsx` 组件
- [X] T042 [US3] 创建 `src/components/PromptExpander/ExpansionOptions.module.css` 样式文件
- [X] T043 [US3] 在ExpansionOptions组件中实现选项列表/卡片展示
- [X] T044 [US3] 在ExpansionOptions组件中实现选择交互和视觉反馈
- [X] T045 [US3] 在ExpansionOptions组件中实现确认和取消选择功能

---

### Phase 6: User Story 4 - 迭代拓展过程

**目标**: 用户可以完成5-10次迭代拓展，每次基于前一次选择继续

**独立测试标准**:
- 系统正确记录和显示迭代次数（1-10）
- 每次迭代基于前一次选择生成新方向
- 在达到5次迭代后显示"完成拓展"选项
- 在达到10次迭代后自动进入最终生成
- 可以查看拓展历史

#### 状态管理

- [X] T046 [US4] 创建 `src/hooks/usePromptExpander.ts` Hook
- [X] T047 [US4] 在 `src/hooks/usePromptExpander.ts` 中实现迭代状态管理
- [X] T048 [US4] 在 `src/hooks/usePromptExpander.ts` 中实现迭代流程控制（开始、继续、完成）

#### 进度组件

- [X] T049 [US4] 创建 `src/components/PromptExpander/IterationProgress.tsx` 组件
- [X] T050 [US4] 创建 `src/components/PromptExpander/IterationProgress.module.css` 样式文件
- [X] T051 [US4] 在IterationProgress组件中实现迭代次数显示和进度条

#### 主组件集成

- [X] T052 [US4] 在 `src/components/PromptExpander/PromptExpander.tsx` 中集成迭代流程逻辑

---

### Phase 7: User Story 5 - 生成最终提示词

**目标**: 系统能够生成详细、完整的最终提示词

**独立测试标准**:
- 最终提示词包含所有迭代内容
- 提示词结构清晰、逻辑完整
- 支持Markdown格式显示
- 可以完整复制提示词
- 生成过程显示进度

#### AI服务实现

- [X] T053 [US5] 在 `src/services/aiService.ts` 中实现generateFinalPrompt方法
- [X] T054 [US5] 在 `src/services/aiService.ts` 中实现最终提示词提示词构建逻辑
- [X] T055 [US5] 在 `src/services/aiService.ts` 中实现响应解析（解析为FinalPrompt）

#### Hook实现

- [X] T056 [US5] 在 `src/hooks/useAIService.ts` 中实现generateFinalPrompt方法
- [X] T057 [US5] 在 `src/hooks/usePromptExpander.ts` 中实现最终提示词生成逻辑

#### 组件实现

- [X] T058 [US5] 创建 `src/components/PromptExpander/FinalPrompt.tsx` 组件
- [X] T059 [US5] 创建 `src/components/PromptExpander/FinalPrompt.module.css` 样式文件
- [X] T060 [US5] 在FinalPrompt组件中实现提示词展示（支持Markdown渲染）
- [X] T061 [US5] 在FinalPrompt组件中实现一键复制功能
- [X] T062 [US5] 在FinalPrompt组件中实现统计信息显示（字数、段落数）

#### 工具函数

- [X] T063 [US5] 在 `src/utils/promptFormatter.ts` 中实现字数统计函数
- [X] T064 [US5] 在 `src/utils/promptFormatter.ts` 中实现段落数统计函数

---

### Phase 8: User Story 6 - 保存和导出提示词

**目标**: 用户可以保存和导出生成的提示词

**独立测试标准**:
- 可以保存提示词到本地存储
- 可以导出为.txt文件
- 可以导出为.md文件
- 保存的文件包含元信息
- 保存操作有明确的成功/失败反馈

#### 存储服务实现

- [X] T065 [US6] 在 `src/services/storageService.ts` 中实现savePrompt方法
- [X] T066 [US6] 在 `src/services/storageService.ts` 中实现文件保存逻辑（JSON格式）

#### 导出功能实现

- [X] T067 [US6] 在 `electron/main.ts` 中实现文件导出逻辑（使用dialog.showSaveDialog）
- [X] T068 [US6] 在 `src/utils/promptFormatter.ts` 中实现formatPromptForExport函数（支持txt和md格式）

#### Hook实现

- [X] T069 [US6] 在 `src/hooks/usePromptExpander.ts` 中实现savePrompt方法
- [X] T070 [US6] 在 `src/hooks/usePromptExpander.ts` 中实现exportPrompt方法

#### 组件集成

- [X] T071 [US6] 在FinalPrompt组件中集成保存和导出按钮
- [X] T072 [US6] 在FinalPrompt组件中实现保存/导出成功/失败反馈

---

### Phase 9: User Story 7 - 查看拓展历史

**目标**: 用户可以查看完整的迭代拓展历史记录

**独立测试标准**:
- 显示每次迭代的拓展方向和选择
- 历史记录以时间线或树状结构展示
- 可以展开/折叠查看详细信息
- 支持导航到特定迭代

#### 组件实现

- [X] T073 [US7] 创建 `src/components/PromptExpander/HistoryView.tsx` 组件
- [X] T074 [US7] 创建 `src/components/PromptExpander/HistoryView.module.css` 样式文件
- [X] T075 [US7] 在HistoryView组件中实现历史记录展示（时间线/树状结构）
- [X] T076 [US7] 在HistoryView组件中实现展开/折叠功能

#### 主组件集成

- [X] T077 [US7] 在 `src/components/PromptExpander/PromptExpander.tsx` 中集成HistoryView组件
- [X] T078 [US7] 在PromptExpander组件中实现历史记录查看切换功能

---

### Phase 10: Polish & Cross-Cutting Concerns

#### 主组件完善

- [X] T079 创建 `src/components/PromptExpander/PromptExpander.tsx` 主组件
- [X] T080 创建 `src/components/PromptExpander/PromptExpander.module.css` 样式文件
- [X] T081 在PromptExpander组件中实现完整的状态管理和流程控制
- [X] T082 在PromptExpander组件中实现错误处理和用户反馈

#### 应用集成

- [X] T083 在 `src/App.tsx` 中添加prompt-expander工具页面路由
- [X] T084 在 `src/App.tsx` 中实现懒加载PromptExpander组件

#### 样式优化

- [X] T085 优化所有组件的响应式布局（已在各组件CSS中实现响应式设计）
- [X] T086 实现加载状态和错误状态的视觉反馈（已在各组件中实现）

#### 错误处理完善

- [X] T087 实现全局错误边界组件
- [X] T088 完善所有错误场景的用户提示（已在各组件中实现错误提示）

---

## 独立测试标准总结

### US1: 输入初始需求
- ✅ 输入验证（10-2000字符）
- ✅ 字符计数显示
- ✅ 提交按钮状态管理
- ✅ 错误提示

### US2: AI生成拓展方向
- ✅ 生成3-5个方向
- ✅ 加载状态显示
- ✅ 错误处理和重试
- ✅ 响应时间<15秒

### US3: 选择拓展方向
- ✅ 选项展示（卡片/列表）
- ✅ 选择交互和反馈
- ✅ 确认和取消功能

### US4: 迭代拓展过程
- ✅ 迭代次数记录和显示
- ✅ 基于前一次选择继续拓展
- ✅ 提前完成选项（5次后）
- ✅ 自动完成（10次后）

### US5: 生成最终提示词
- ✅ 提示词包含所有迭代内容
- ✅ Markdown格式支持
- ✅ 一键复制功能
- ✅ 统计信息显示

### US6: 保存和导出
- ✅ 保存到本地存储
- ✅ 导出为.txt和.md
- ✅ 元信息包含
- ✅ 操作反馈

### US7: 查看拓展历史
- ✅ 历史记录展示
- ✅ 展开/折叠功能
- ✅ 导航功能

## 实施建议

### 开发顺序
1. **Week 1**: Phase 1-2 (Setup + Foundational)
2. **Week 2**: Phase 3-5 (US1-US3, MVP)
3. **Week 3**: Phase 6-7 (US4-US5, 完整流程)
4. **Week 4**: Phase 8-10 (US6-US7 + Polish)

### 并行开发建议
- T019-T024 可以并行开发（不同服务文件）
- T027-T032 可以并行开发（组件和样式）
- T033-T039 可以并行开发（AI服务不同方法）

### 测试策略
- 每个Phase完成后进行独立测试
- MVP完成后进行端到端测试
- 所有功能完成后进行完整测试

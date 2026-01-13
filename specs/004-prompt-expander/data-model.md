# Prompt迭代拓展生成工具数据模型

## 概述

本文档定义Prompt迭代拓展生成工具所需的数据结构和数据流。

## 核心实体

### 1. ExpansionOption (拓展方向)

表示AI生成的一个拓展方向选项。

```typescript
interface ExpansionOption {
  id: string;                    // 唯一标识符
  title: string;                 // 标题（简短描述，<100字符）
  description: string;           // 详细说明（<500字符）
  generatedAt: string;           // 生成时间戳
}
```

**验证规则**:
- `id`: 必填，UUID格式
- `title`: 必填，长度1-100字符
- `description`: 必填，长度1-500字符
- `generatedAt`: 必填，ISO 8601格式

### 2. ExpansionStep (拓展步骤)

表示一次迭代拓展的完整信息。

```typescript
interface ExpansionStep {
  iteration: number;              // 迭代次数（1-10）
  options: ExpansionOption[];    // 生成的拓展方向列表（3-5个）
  selectedOptionId: string | null; // 用户选择的方向ID（null表示未选择）
  selectedAt: string | null;      // 选择时间戳
  createdAt: string;              // 步骤创建时间
}
```

**验证规则**:
- `iteration`: 必填，范围1-10
- `options`: 必填，数组长度3-5
- `selectedOptionId`: 可选，如果提供必须存在于options中
- `selectedAt`: 如果selectedOptionId存在则必填
- `createdAt`: 必填，ISO 8601格式

**状态转换**:
- `created`: 步骤已创建，选项已生成
- `selected`: 用户已选择拓展方向
- `completed`: 已进入下一轮迭代或完成

### 3. ExpansionHistory (拓展历史)

完整的迭代拓展历史记录。

```typescript
interface ExpansionHistory {
  steps: ExpansionStep[];        // 所有迭代步骤
  totalIterations: number;        // 总迭代次数（steps.length）
  startedAt: string;             // 开始时间
  completedAt: string | null;     // 完成时间（null表示未完成）
}
```

**验证规则**:
- `steps`: 必填，数组长度5-10
- `totalIterations`: 必填，等于steps.length，范围5-10
- `startedAt`: 必填，ISO 8601格式
- `completedAt`: 可选，如果提供必须晚于startedAt

### 4. FinalPrompt (最终提示词)

生成的最终提示词及其元数据。

```typescript
interface FinalPrompt {
  content: string;               // 提示词内容（200-5000字符）
  format: 'text' | 'markdown';    // 格式类型
  wordCount: number;              // 字数统计
  paragraphCount: number;         // 段落数统计
  generatedAt: string;            // 生成时间戳
}
```

**验证规则**:
- `content`: 必填，长度200-5000字符
- `format`: 必填，'text'或'markdown'
- `wordCount`: 必填，正整数
- `paragraphCount`: 必填，正整数
- `generatedAt`: 必填，ISO 8601格式

### 5. PromptExpanderState (工具状态)

整个工具的应用状态。

```typescript
interface PromptExpanderState {
  // 初始输入
  initialRequirement: string;     // 初始需求（10-2000字符）
  
  // 当前迭代状态
  currentIteration: number;        // 当前迭代次数（0-10，0表示未开始）
  currentStep: ExpansionStep | null; // 当前步骤（null表示未开始或已完成）
  
  // 历史记录
  expansionHistory: ExpansionHistory | null; // 拓展历史（null表示未开始）
  
  // 最终结果
  finalPrompt: FinalPrompt | null; // 最终提示词（null表示未生成）
  
  // UI状态
  isLoading: boolean;             // 是否正在加载（AI调用中）
  error: string | null;           // 错误信息（null表示无错误）
  
  // 元数据
  createdAt: string;              // 状态创建时间
  updatedAt: string;              // 最后更新时间
}
```

**验证规则**:
- `initialRequirement`: 如果currentIteration > 0则必填，长度10-2000字符
- `currentIteration`: 必填，范围0-10
- `currentStep`: 如果currentIteration > 0且<10则必填
- `expansionHistory`: 如果currentIteration > 0则必填
- `finalPrompt`: 如果currentIteration === 10或用户选择完成则可能非空
- `isLoading`: 必填，布尔值
- `error`: 可选，字符串
- `createdAt`: 必填，ISO 8601格式
- `updatedAt`: 必填，ISO 8601格式，必须晚于或等于createdAt

**状态转换**:
1. `idle`: initialRequirement为空，currentIteration === 0
2. `inputting`: 用户正在输入初始需求
3. `expanding`: 正在生成拓展方向（isLoading === true）
4. `selecting`: 拓展方向已生成，等待用户选择
5. `iterating`: 正在进行迭代（currentIteration 1-9）
6. `generating`: 正在生成最终提示词（isLoading === true，currentIteration === 10）
7. `completed`: 最终提示词已生成（finalPrompt !== null）
8. `error`: 发生错误（error !== null）

### 6. SavedPrompt (保存的提示词)

保存到本地的提示词数据。

```typescript
interface SavedPrompt {
  id: string;                     // 唯一标识符（UUID）
  initialRequirement: string;      // 初始需求
  expansionHistory: ExpansionHistory; // 拓展历史
  finalPrompt: FinalPrompt;        // 最终提示词
  metadata: {
    createdAt: string;             // 创建时间
    savedAt: string;               // 保存时间
    iterationCount: number;        // 迭代次数
    version: string;               // 数据版本（用于兼容性）
  };
}
```

**验证规则**:
- `id`: 必填，UUID格式
- `initialRequirement`: 必填，长度10-2000字符
- `expansionHistory`: 必填，符合ExpansionHistory验证规则
- `finalPrompt`: 必填，符合FinalPrompt验证规则
- `metadata.createdAt`: 必填，ISO 8601格式
- `metadata.savedAt`: 必填，ISO 8601格式，必须晚于或等于createdAt
- `metadata.iterationCount`: 必填，范围5-10，等于expansionHistory.totalIterations
- `metadata.version`: 必填，语义化版本号（如"1.0.0"）

## 数据流

### 1. 迭代拓展流程

```
用户输入初始需求
  ↓
创建PromptExpanderState (currentIteration = 0)
  ↓
用户点击"开始拓展"
  ↓
currentIteration = 1, isLoading = true
  ↓
调用AI生成拓展方向 (3-5个ExpansionOption)
  ↓
创建ExpansionStep (iteration = 1, options = [...])
  ↓
isLoading = false, 显示拓展方向
  ↓
用户选择拓展方向
  ↓
更新ExpansionStep (selectedOptionId, selectedAt)
  ↓
currentIteration = 2 (如果 < 10)
  ↓
重复生成和选择过程...
  ↓
currentIteration = 10 或用户选择"完成拓展"
  ↓
isLoading = true, 调用AI生成最终提示词
  ↓
创建FinalPrompt
  ↓
isLoading = false, finalPrompt !== null
  ↓
状态: completed
```

### 2. 数据持久化流程

```
用户点击"保存"
  ↓
构建SavedPrompt对象
  ↓
序列化为JSON
  ↓
通过IPC发送到主进程
  ↓
主进程保存到文件系统
  ↓
文件路径: {userData}/prompts/{id}.json
  ↓
返回保存结果
```

### 3. 文件导出流程

```
用户点击"导出"
  ↓
选择导出格式 (.txt 或 .md)
  ↓
格式化FinalPrompt内容
  ↓
通过IPC发送导出请求到主进程
  ↓
主进程调用dialog.showSaveDialog
  ↓
用户选择保存位置
  ↓
主进程写入文件
  ↓
返回导出结果
```

## 数据验证

### 客户端验证
- 使用TypeScript类型系统进行编译时验证
- 使用运行时验证函数确保数据完整性
- 在状态更新时进行验证

### 服务端验证（如适用）
- 如果未来需要服务端存储，需要实现相应的验证逻辑

## 数据迁移

### 版本兼容性
- 使用`metadata.version`字段管理数据版本
- 实现版本迁移函数，支持旧版本数据升级

### 迁移策略
- 读取数据时检查版本号
- 如果版本不匹配，调用迁移函数
- 迁移后更新版本号

## 存储格式

### JSON格式（本地存储）
```json
{
  "id": "uuid",
  "initialRequirement": "string",
  "expansionHistory": {
    "steps": [...],
    "totalIterations": 7,
    "startedAt": "2024-12-19T10:00:00Z",
    "completedAt": "2024-12-19T10:05:00Z"
  },
  "finalPrompt": {
    "content": "string",
    "format": "markdown",
    "wordCount": 500,
    "paragraphCount": 5,
    "generatedAt": "2024-12-19T10:05:00Z"
  },
  "metadata": {
    "createdAt": "2024-12-19T10:00:00Z",
    "savedAt": "2024-12-19T10:06:00Z",
    "iterationCount": 7,
    "version": "1.0.0"
  }
}
```

### 文本导出格式（.txt）
```
[提示词内容]

---
生成时间: 2024-12-19 10:05:00
迭代次数: 7
初始需求: [初始需求内容]
```

### Markdown导出格式（.md）
```markdown
# Prompt

[提示词内容]

---
**生成时间**: 2024-12-19 10:05:00  
**迭代次数**: 7  
**初始需求**: [初始需求内容]
```

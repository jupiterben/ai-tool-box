# Electron IPC 接口定义

## 概述

本文档定义渲染进程和主进程之间的IPC通信接口。

## IPC Channel 定义

### 1. AI服务调用

#### 生成拓展方向

**Channel**: `ai:generate-expansion-options`

**请求** (渲染进程 → 主进程):
```typescript
interface GenerateExpansionOptionsRequest {
  initialRequirement: string;      // 初始需求
  currentContext: string;            // 当前上下文（包含之前的选择）
  iteration: number;                 // 当前迭代次数
  count?: number;                    // 生成数量（默认5，范围3-5）
  provider?: 'openai' | 'deepseek';  // AI服务提供商（默认'deepseek'）
}
```

**响应** (主进程 → 渲染进程):
```typescript
interface GenerateExpansionOptionsResponse {
  success: boolean;
  options?: ExpansionOption[];       // 拓展方向列表
  error?: string;                     // 错误信息
}
```

**错误处理**:
- 网络错误: `{ success: false, error: 'Network error: ...' }`
- API错误: `{ success: false, error: 'API error: ...' }`
- 超时: `{ success: false, error: 'Request timeout' }`

#### 生成最终提示词

**Channel**: `ai:generate-final-prompt`

**请求** (渲染进程 → 主进程):
```typescript
interface GenerateFinalPromptRequest {
  initialRequirement: string;         // 初始需求
  expansionHistory: ExpansionHistory; // 完整的拓展历史
  format?: 'text' | 'markdown';        // 输出格式（默认'markdown'）
  provider?: 'openai' | 'deepseek';   // AI服务提供商（默认'deepseek'）
}
```

**响应** (主进程 → 渲染进程):
```typescript
interface GenerateFinalPromptResponse {
  success: boolean;
  prompt?: FinalPrompt;               // 最终提示词
  error?: string;                     // 错误信息
}
```

**错误处理**:
- 网络错误: `{ success: false, error: 'Network error: ...' }`
- API错误: `{ success: false, error: 'API error: ...' }`
- 超时: `{ success: false, error: 'Request timeout' }`

### 2. 文件存储

#### 保存提示词

**Channel**: `storage:save-prompt`

**请求** (渲染进程 → 主进程):
```typescript
interface SavePromptRequest {
  prompt: SavedPrompt;                 // 要保存的提示词数据
}
```

**响应** (主进程 → 渲染进程):
```typescript
interface SavePromptResponse {
  success: boolean;
  filePath?: string;                   // 保存的文件路径
  error?: string;                      // 错误信息
}
```

**错误处理**:
- 文件系统错误: `{ success: false, error: 'File system error: ...' }`
- 权限错误: `{ success: false, error: 'Permission denied' }`

#### 加载提示词列表

**Channel**: `storage:load-prompt-list`

**请求** (渲染进程 → 主进程):
```typescript
interface LoadPromptListRequest {
  limit?: number;                      // 返回数量限制（默认50）
  offset?: number;                     // 偏移量（默认0）
}
```

**响应** (主进程 → 渲染进程):
```typescript
interface LoadPromptListResponse {
  success: boolean;
  prompts?: Array<{
    id: string;
    initialRequirement: string;
    finalPrompt: {
      content: string;
      wordCount: number;
    };
    metadata: {
      createdAt: string;
      savedAt: string;
      iterationCount: number;
    };
  }>;
  total?: number;                      // 总数
  error?: string;
}
```

#### 加载单个提示词

**Channel**: `storage:load-prompt`

**请求** (渲染进程 → 主进程):
```typescript
interface LoadPromptRequest {
  id: string;                          // 提示词ID
}
```

**响应** (主进程 → 渲染进程):
```typescript
interface LoadPromptResponse {
  success: boolean;
  prompt?: SavedPrompt;                // 完整的提示词数据
  error?: string;
}
```

#### 删除提示词

**Channel**: `storage:delete-prompt`

**请求** (渲染进程 → 主进程):
```typescript
interface DeletePromptRequest {
  id: string;                          // 提示词ID
}
```

**响应** (主进程 → 渲染进程):
```typescript
interface DeletePromptResponse {
  success: boolean;
  error?: string;
}
```

### 3. 文件导出

#### 导出提示词

**Channel**: `export:save-prompt-file`

**请求** (渲染进程 → 主进程):
```typescript
interface ExportPromptRequest {
  prompt: FinalPrompt;                 // 要导出的提示词
  format: 'txt' | 'md';                // 导出格式
  includeMetadata?: boolean;            // 是否包含元数据（默认true）
  metadata?: {
    initialRequirement: string;
    iterationCount: number;
    createdAt: string;
  };
}
```

**响应** (主进程 → 渲染进程):
```typescript
interface ExportPromptResponse {
  success: boolean;
  filePath?: string;                   // 保存的文件路径
  cancelled?: boolean;                  // 用户是否取消了对话框
  error?: string;
}
```

**流程**:
1. 渲染进程发送导出请求
2. 主进程显示保存对话框（dialog.showSaveDialog）
3. 用户选择保存位置或取消
4. 如果用户选择位置，主进程写入文件
5. 返回结果

## 类型定义

### ExpansionOption
```typescript
interface ExpansionOption {
  id: string;
  title: string;
  description: string;
  generatedAt: string;
}
```

### ExpansionHistory
```typescript
interface ExpansionHistory {
  steps: ExpansionStep[];
  totalIterations: number;
  startedAt: string;
  completedAt: string | null;
}
```

### ExpansionStep
```typescript
interface ExpansionStep {
  iteration: number;
  options: ExpansionOption[];
  selectedOptionId: string | null;
  selectedAt: string | null;
  createdAt: string;
}
```

### FinalPrompt
```typescript
interface FinalPrompt {
  content: string;
  format: 'text' | 'markdown';
  wordCount: number;
  paragraphCount: number;
  generatedAt: string;
}
```

### SavedPrompt
```typescript
interface SavedPrompt {
  id: string;
  initialRequirement: string;
  expansionHistory: ExpansionHistory;
  finalPrompt: FinalPrompt;
  metadata: {
    createdAt: string;
    savedAt: string;
    iterationCount: number;
    version: string;
  };
}
```

## 使用示例

### 渲染进程调用示例

```typescript
// 生成拓展方向
const response = await window.electronAPI.invoke('ai:generate-expansion-options', {
  initialRequirement: '创建一个待办事项应用',
  currentContext: '...',
  iteration: 1,
  count: 5,
  provider: 'deepseek'
});

if (response.success && response.options) {
  // 处理拓展方向
  setExpansionOptions(response.options);
} else {
  // 处理错误
  setError(response.error);
}

// 保存提示词
const saveResponse = await window.electronAPI.invoke('storage:save-prompt', {
  prompt: savedPromptData
});

// 导出提示词
const exportResponse = await window.electronAPI.invoke('export:save-prompt-file', {
  prompt: finalPrompt,
  format: 'md',
  includeMetadata: true,
  metadata: {
    initialRequirement: '...',
    iterationCount: 7,
    createdAt: '...'
  }
});
```

### 主进程处理示例

```typescript
// 注册IPC处理器
ipcMain.handle('ai:generate-expansion-options', async (event, request: GenerateExpansionOptionsRequest) => {
  try {
    const options = await aiService.generateExpansionOptions(request);
    return { success: true, options };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('storage:save-prompt', async (event, request: SavePromptRequest) => {
  try {
    const filePath = await storageService.savePrompt(request.prompt);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export:save-prompt-file', async (event, request: ExportPromptRequest) => {
  try {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: request.format === 'md' ? 'Markdown' : 'Text', extensions: [request.format] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, cancelled: true };
    }
    
    await fs.writeFile(result.filePath, formatPromptContent(request.prompt, request));
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## 错误码定义

### AI服务错误
- `AI_NETWORK_ERROR`: 网络连接错误
- `AI_API_ERROR`: API调用错误
- `AI_TIMEOUT`: 请求超时
- `AI_INVALID_RESPONSE`: 响应格式错误
- `AI_RATE_LIMIT`: 请求频率限制

### 存储错误
- `STORAGE_FILE_ERROR`: 文件操作错误
- `STORAGE_PERMISSION_DENIED`: 权限不足
- `STORAGE_NOT_FOUND`: 文件不存在
- `STORAGE_INVALID_DATA`: 数据格式错误

### 导出错误
- `EXPORT_CANCELLED`: 用户取消操作
- `EXPORT_FILE_ERROR`: 文件写入错误
- `EXPORT_INVALID_FORMAT`: 格式不支持

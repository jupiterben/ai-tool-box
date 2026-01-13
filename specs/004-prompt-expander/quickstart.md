# Prompt迭代拓展生成工具快速开始

## 概述

本文档提供Prompt迭代拓展生成工具的快速开始指南，帮助开发者快速理解项目结构和开始开发。

## 项目结构

```
src/
├── components/
│   └── PromptExpander/          # Prompt拓展工具组件
│       ├── PromptExpander.tsx   # 主组件
│       ├── PromptExpander.module.css
│       ├── InitialInput.tsx     # 初始需求输入
│       ├── ExpansionOptions.tsx # 拓展方向展示
│       ├── IterationProgress.tsx # 迭代进度
│       ├── FinalPrompt.tsx      # 最终提示词展示
│       └── HistoryView.tsx      # 历史记录查看
├── hooks/
│   ├── usePromptExpander.ts     # 核心逻辑Hook
│   └── useAIService.ts          # AI服务调用Hook
├── services/                    # 主进程服务（Electron）
│   ├── aiService.ts             # AI服务封装
│   └── storageService.ts        # 存储服务
├── types/
│   └── prompt-expander.ts       # 类型定义
└── utils/
    └── promptFormatter.ts       # 提示词格式化工具
```

## 核心概念

### 1. 迭代拓展流程

```
用户输入初始需求
  ↓
AI生成3-5个拓展方向
  ↓
用户选择一个方向
  ↓
基于选择继续拓展（重复5-10次）
  ↓
生成最终详细提示词
```

### 2. 状态管理

使用`usePromptExpander` Hook管理整个流程状态：

```typescript
const {
  state,
  setInitialRequirement,
  startExpansion,
  selectExpansionOption,
  confirmSelection,
  generateFinalPrompt,
  savePrompt,
  exportPrompt
} = usePromptExpander();
```

### 3. AI服务集成

通过Electron IPC与主进程通信，主进程调用AI API：

```
渲染进程 → IPC → 主进程 → AI API
```

## 开发步骤

### Step 1: 设置类型定义

创建 `src/types/prompt-expander.ts`:

```typescript
export interface ExpansionOption {
  id: string;
  title: string;
  description: string;
  generatedAt: string;
}

export interface ExpansionStep {
  iteration: number;
  options: ExpansionOption[];
  selectedOptionId: string | null;
  selectedAt: string | null;
  createdAt: string;
}

// ... 其他类型定义
```

### Step 2: 实现主进程服务

创建 `src/services/aiService.ts` (主进程):

```typescript
import { https } from 'node:https';

export class AIService {
  async generateExpansionOptions(request: GenerateExpansionOptionsRequest): Promise<ExpansionOption[]> {
    // 实现AI API调用
    // 使用Node.js原生https模块
  }
  
  async generateFinalPrompt(request: GenerateFinalPromptRequest): Promise<FinalPrompt> {
    // 实现最终提示词生成
  }
}
```

### Step 3: 设置IPC通信

在 `electron/main.ts` 中注册IPC处理器:

```typescript
import { ipcMain } from 'electron';
import { AIService } from './services/aiService';

const aiService = new AIService();

ipcMain.handle('ai:generate-expansion-options', async (event, request) => {
  try {
    const options = await aiService.generateExpansionOptions(request);
    return { success: true, options };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

在 `electron/preload.ts` 中暴露API:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data)
});
```

### Step 4: 实现核心Hook

创建 `src/hooks/usePromptExpander.ts`:

```typescript
export function usePromptExpander() {
  const [state, setState] = useState<PromptExpanderState>(initialState);
  
  const startExpansion = async () => {
    // 调用AI生成拓展方向
    // 更新状态
  };
  
  const selectExpansionOption = (optionId: string) => {
    // 更新选择状态
  };
  
  // ... 其他方法
  
  return {
    state,
    startExpansion,
    selectExpansionOption,
    // ...
  };
}
```

### Step 5: 创建UI组件

创建 `src/components/PromptExpander/PromptExpander.tsx`:

```typescript
export const PromptExpander: React.FC = () => {
  const {
    state,
    setInitialRequirement,
    startExpansion,
    // ...
  } = usePromptExpander();
  
  return (
    <div className={styles.container}>
      {state.currentIteration === 0 && (
        <InitialInput
          value={state.initialRequirement}
          onChange={setInitialRequirement}
          onSubmit={startExpansion}
        />
      )}
      
      {state.currentIteration > 0 && state.currentIteration < 10 && (
        <>
          <IterationProgress
            currentIteration={state.currentIteration}
            totalIterations={10}
          />
          <ExpansionOptions
            options={state.currentStep?.options || []}
            selectedId={state.currentStep?.selectedOptionId || null}
            onSelect={selectExpansionOption}
            onConfirm={confirmSelection}
          />
        </>
      )}
      
      {state.finalPrompt && (
        <FinalPrompt
          prompt={state.finalPrompt}
          onSave={savePrompt}
          onExport={exportPrompt}
        />
      )}
    </div>
  );
};
```

### Step 6: 集成到主应用

在 `src/App.tsx` 中添加新工具:

```typescript
const TOOL_PAGES: ToolPage[] = [
  {
    id: 'multi-webview',
    name: '多Webview工具',
    iconName: 'Globe',
  },
  {
    id: 'prompt-expander',
    name: 'Prompt拓展工具',
    iconName: 'Sparkles', // 或其他合适的图标
  },
];

// 在renderActivePage中添加:
case 'prompt-expander':
  return (
    <Suspense fallback={<LoadingPlaceholder />}>
      <PromptExpander />
    </Suspense>
  );
```

## 关键实现细节

### 1. AI服务调用

**主进程实现** (`src/services/aiService.ts`):

```typescript
import { https } from 'node:https';
import { URL } from 'node:url';

export class AIService {
  private apiKey: string;
  private provider: 'openai' | 'deepseek' = 'deepseek';
  
  async generateExpansionOptions(request: GenerateExpansionOptionsRequest): Promise<ExpansionOption[]> {
    const prompt = this.buildExpansionPrompt(request);
    const response = await this.callAPI(prompt);
    return this.parseExpansionOptions(response);
  }
  
  private async callAPI(prompt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL('https://api.deepseek.com/v1/chat/completions');
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      };
      
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }]
      }));
      req.end();
    });
  }
}
```

### 2. 状态管理

**使用React Context** (`src/components/PromptExpander/PromptExpanderContext.tsx`):

```typescript
const PromptExpanderContext = createContext<PromptExpanderContextValue | null>(null);

export function PromptExpanderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PromptExpanderState>(initialState);
  
  // 状态更新逻辑
  
  return (
    <PromptExpanderContext.Provider value={{ state, ...actions }}>
      {children}
    </PromptExpanderContext.Provider>
  );
}
```

### 3. 错误处理

```typescript
const handleAICall = async () => {
  try {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const result = await aiService.generateExpansionOptions(request);
    setState(prev => ({ ...prev, isLoading: false, currentStep: result }));
  } catch (error) {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: error.message
    }));
  }
};
```

### 4. 重试机制

```typescript
const retry = async () => {
  if (state.error) {
    clearError();
    await handleAICall();
  }
};
```

## 测试要点

### 1. 单元测试

- 测试状态转换逻辑
- 测试数据验证函数
- 测试格式化工具函数

### 2. 集成测试

- 测试IPC通信
- 测试AI服务调用（使用模拟数据）
- 测试文件存储和导出

### 3. 端到端测试

- 测试完整迭代流程（5-10次）
- 测试错误处理和重试
- 测试保存和导出功能

## 配置要求

### 1. AI API密钥

需要在Electron主进程中配置API密钥：

```typescript
// electron/main.ts
import { safeStorage } from 'electron';

// 存储API密钥
safeStorage.encryptString(apiKey);

// 读取API密钥
const apiKey = safeStorage.decryptString(encryptedKey);
```

### 2. 存储路径

使用Electron用户数据目录:

```typescript
import { app } from 'electron';
import { join } from 'node:path';

const storagePath = join(app.getPath('userData'), 'prompts');
```

## 常见问题

### Q: 如何处理AI API调用失败？

A: 实现重试机制（最多3次），显示友好的错误提示，提供重试按钮。

### Q: 如何优化AI调用性能？

A: 使用异步处理，不阻塞UI，显示加载状态，实现请求超时（30秒）。

### Q: 如何管理大量历史记录？

A: 实现分页加载，限制内存中的记录数量，使用文件系统存储。

### Q: 如何支持多个AI服务提供商？

A: 实现统一的AI服务接口，支持配置不同的提供商，通过IPC传递提供商参数。

## 下一步

1. 阅读完整规范: [spec.md](./spec.md)
2. 查看技术规划: [plan.md](./plan.md)
3. 了解数据模型: [data-model.md](./data-model.md)
4. 查看API合约: [contracts/](./contracts/)

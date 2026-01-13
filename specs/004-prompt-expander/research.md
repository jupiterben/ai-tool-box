# Prompt迭代拓展生成工具技术选型研究

## 研究目标

为Prompt迭代拓展生成工具确定最佳技术方案，在满足功能需求的同时，遵循项目宪法原则（最小依赖、现代标准、代码质量、性能优先）。

## 技术选型决策

### 1. AI服务集成方案

#### 研究问题
当前项目通过webview嵌入AI工具（ChatGPT、DeepSeek等），没有直接的AI API集成。需要确定如何实现AI调用功能，用于生成拓展方向和最终提示词。

#### 评估选项

**选项 A: 通过webview与AI服务通信**
- **可行性**: 需要研究webview与主进程通信机制
- **复杂度**: 高（需要处理跨域、安全策略等）
- **可靠性**: 低（依赖第三方网站结构，易受变更影响）
- **性能**: 中等（需要等待页面加载）
- **符合宪法**: ⚠️ 部分符合（零依赖但不可靠）

**选项 B: 引入独立AI API服务（OpenAI/DeepSeek API）**
- **可行性**: 高（标准REST API）
- **复杂度**: 低（使用fetch API即可）
- **可靠性**: 高（官方API，稳定可靠）
- **性能**: 高（直接API调用，响应快）
- **依赖**: 仅需fetch API（浏览器原生，零依赖）
- **成本**: 需要API密钥，可能有使用费用
- **符合宪法**: ✅ 符合（零额外依赖，使用原生API）

**选项 C: 使用轻量级AI SDK（如openai npm包）**
- **可行性**: 高
- **复杂度**: 低（封装好的SDK）
- **可靠性**: 高
- **性能**: 高
- **依赖**: ~50-100KB (gzipped)
- **符合宪法**: ❌ 不符合（依赖体积过大）

**选项 D: 使用Electron主进程调用AI API**
- **可行性**: 高（Electron支持Node.js环境）
- **复杂度**: 中等（需要主进程和渲染进程通信）
- **可靠性**: 高
- **性能**: 高
- **依赖**: 可选（可使用Node.js原生http模块，零依赖）
- **符合宪法**: ✅ 符合（使用Electron内置能力）

#### 决策
**选择: 选项 B (独立AI API服务) + 选项 D (Electron主进程) 混合方案**

**决策理由**:
1. **符合最小依赖原则**: 使用浏览器原生fetch API或Node.js原生http模块，零额外依赖
2. **可靠性高**: 使用官方API，不受第三方网站变更影响
3. **性能优秀**: 直接API调用，响应速度快
4. **灵活性高**: 可以选择不同的AI服务提供商（OpenAI、DeepSeek、Claude等）
5. **架构清晰**: 通过Electron主进程处理API调用，符合Electron最佳实践

**实施策略**:
- 使用Electron IPC（Inter-Process Communication）实现主进程和渲染进程通信
- 主进程使用Node.js原生http/https模块调用AI API（零依赖）
- 渲染进程通过IPC发送请求，接收响应
- 实现统一的AI服务接口，支持多个AI服务提供商
- 配置管理：API密钥存储在Electron的safeStorage中

**API选择建议**:
- 优先支持DeepSeek API（成本低，性能好）
- 可选支持OpenAI API（兼容性好）
- 接口设计支持扩展其他AI服务

**替代方案考虑**:
- 如果用户没有API密钥，可以提供webview方案作为降级选项
- 未来可以考虑支持本地AI模型（如Ollama）

---

### 2. 状态管理方案

#### 研究问题
需要管理复杂的迭代流程状态，包括：初始需求、每次迭代的拓展方向、用户选择、迭代历史、最终提示词等。

#### 评估选项

**选项 A: React Context + useState**
- **体积**: 0KB（零依赖）
- **复杂度**: 中等（需要合理设计Context结构）
- **性能**: 良好（React内置，优化良好）
- **适用场景**: 中等复杂度的状态管理
- **符合宪法**: ✅ 完全符合

**选项 B: Zustand**
- **体积**: ~1KB (gzipped)
- **复杂度**: 低（API简洁）
- **性能**: 优秀（轻量级，性能好）
- **适用场景**: 中小型应用状态管理
- **符合宪法**: ✅ 符合（体积小）

**选项 C: Jotai**
- **体积**: ~3KB (gzipped)
- **复杂度**: 中等（原子化状态管理）
- **性能**: 优秀
- **适用场景**: 复杂状态管理
- **符合宪法**: ✅ 符合（体积小）

**选项 D: Redux**
- **体积**: ~15KB (gzipped)
- **复杂度**: 高（需要大量样板代码）
- **性能**: 优秀
- **适用场景**: 大型应用
- **符合宪法**: ⚠️ 部分符合（体积较大，可能过度工程化）

#### 决策
**选择: 选项 A (React Context + useState) + 选项 B (Zustand) 渐进式方案**

**决策理由**:
1. **符合最小依赖原则**: 优先使用React Context，零依赖
2. **渐进式采用**: 如果Context不够用，再考虑引入Zustand（体积仅1KB）
3. **灵活性**: 可以根据实际需求选择方案
4. **性能**: 两种方案性能都很好

**实施策略**:
- **第一阶段**: 使用React Context + useState实现状态管理
  - 创建PromptExpanderContext管理全局状态
  - 使用useReducer处理复杂状态逻辑
  - 将状态逻辑封装到自定义Hook中
- **如果Context不够用**: 引入Zustand
  - 仅1KB体积，符合最小依赖原则
  - API简洁，易于使用
  - 性能优秀

**状态结构设计**:
```typescript
interface PromptExpanderState {
  initialRequirement: string;
  currentIteration: number;
  expansionHistory: ExpansionStep[];
  selectedPaths: string[];
  finalPrompt: string | null;
  isLoading: boolean;
  error: string | null;
}
```

---

### 3. 本地存储方案

#### 研究问题
需要保存提示词和历史记录，支持持久化和后续查看。

#### 评估选项

**选项 A: Electron localStorage (渲染进程)**
- **存储位置**: 用户数据目录
- **容量**: 通常5-10MB限制
- **访问方式**: 同步API，简单易用
- **数据格式**: 仅支持字符串
- **符合宪法**: ✅ 符合（零依赖）

**选项 B: Electron文件系统 (主进程)**
- **存储位置**: 用户数据目录或自定义位置
- **容量**: 无限制
- **访问方式**: 异步API，需要IPC通信
- **数据格式**: 支持任意格式（JSON、文本等）
- **符合宪法**: ✅ 符合（使用Electron内置能力）

**选项 C: IndexedDB**
- **存储位置**: 浏览器数据库
- **容量**: 通常较大（几十MB到GB）
- **访问方式**: 异步API
- **数据格式**: 支持结构化数据
- **符合宪法**: ✅ 符合（浏览器原生API）

**选项 D: SQLite (通过Node.js)**
- **存储位置**: 文件系统
- **容量**: 无限制
- **访问方式**: 需要Node.js模块
- **数据格式**: 关系型数据库
- **依赖**: 需要sqlite3包（~100KB+）
- **符合宪法**: ❌ 不符合（依赖体积大，过度工程化）

#### 决策
**选择: 选项 B (Electron文件系统) 为主，选项 A (localStorage) 为辅**

**决策理由**:
1. **符合最小依赖原则**: 使用Electron内置文件系统API，零依赖
2. **灵活性高**: 支持任意数据格式，可以保存为JSON或文本文件
3. **容量充足**: 无存储容量限制
4. **符合Electron最佳实践**: 文件操作在主进程，安全可靠

**实施策略**:
- **提示词保存**: 使用文件系统，保存为JSON格式（包含元数据）
- **历史记录**: 使用文件系统，保存为JSON数组
- **临时状态**: 使用localStorage保存当前会话状态（如未完成的迭代）
- **存储位置**: Electron的app.getPath('userData')目录下的prompts子目录
- **文件命名**: 使用时间戳和UUID确保唯一性

**数据格式设计**:
```typescript
interface SavedPrompt {
  id: string;
  createdAt: string;
  initialRequirement: string;
  iterationCount: number;
  expansionHistory: ExpansionStep[];
  finalPrompt: string;
  metadata?: Record<string, any>;
}
```

---

### 4. 文件导出方案

#### 研究问题
需要导出提示词为.txt或.md文件，支持用户选择保存位置。

#### 评估选项

**选项 A: Electron dialog.showSaveDialog (主进程)**
- **功能**: 完整的文件保存对话框
- **用户体验**: 优秀（原生系统对话框）
- **访问方式**: 需要通过IPC通信
- **符合宪法**: ✅ 符合（Electron内置能力）

**选项 B: Web File System Access API**
- **功能**: 现代浏览器文件访问API
- **用户体验**: 良好（但需要用户授权）
- **兼容性**: 仅支持现代浏览器（Electron Chromium支持）
- **符合宪法**: ✅ 符合（浏览器原生API）

**选项 C: 直接下载（blob URL）**
- **功能**: 触发浏览器下载
- **用户体验**: 中等（用户无法选择保存位置）
- **访问方式**: 简单（无需IPC）
- **符合宪法**: ✅ 符合（浏览器原生API）

#### 决策
**选择: 选项 A (Electron dialog.showSaveDialog)**

**决策理由**:
1. **用户体验最佳**: 原生系统对话框，用户熟悉
2. **功能完整**: 支持选择保存位置和文件名
3. **符合Electron最佳实践**: 文件操作在主进程
4. **符合宪法**: 使用Electron内置能力，零依赖

**实施策略**:
- 渲染进程通过IPC发送导出请求
- 主进程调用dialog.showSaveDialog显示保存对话框
- 用户选择保存位置后，主进程写入文件
- 支持两种格式：.txt（纯文本）和.md（Markdown）
- 文件内容包含提示词和元数据（可选）

**文件格式示例**:
```markdown
# Prompt

[提示词内容]

---
生成时间: 2024-12-19 10:30:00
迭代次数: 7
初始需求: [初始需求内容]
```

---

## 总结

### 最终技术选型

1. **AI服务集成**: Electron主进程 + Node.js原生http模块 + 多个AI API支持
   - 零额外依赖
   - 通过IPC通信
   - 支持OpenAI、DeepSeek等API

2. **状态管理**: React Context + useState（优先），Zustand（备选）
   - 优先零依赖方案
   - 如需要，引入Zustand（仅1KB）

3. **本地存储**: Electron文件系统（主进程）
   - 零依赖
   - 支持JSON和文本格式
   - 存储在用户数据目录

4. **文件导出**: Electron dialog.showSaveDialog
   - 零依赖
   - 原生系统对话框
   - 支持.txt和.md格式

### 依赖评估

- **新增依赖**: 0KB（所有方案都使用原生API或Electron内置能力）
- **可选依赖**: Zustand（1KB，仅在需要时引入）
- **总体积**: 0-1KB，完全符合最小依赖原则

### 实施优先级

1. **Phase 0**: 完成技术选型研究 ✅
2. **Phase 1**: 实现核心功能（AI集成、状态管理、基础组件）
3. **Phase 2**: 实现增强功能（存储、导出、历史记录）
4. **Phase 3**: 集成和测试

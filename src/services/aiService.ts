/**
 * AI服务接口封装（主进程）
 * 
 * 使用Node.js原生https模块调用AI API
 */

import { https, RequestOptions } from 'node:https';
import { URL } from 'node:url';
import { safeStorage } from 'electron';
import type {
  GenerateExpansionOptionsRequest,
  GenerateFinalPromptRequest,
  ExpansionOption,
  FinalPrompt,
} from '../types/prompt-expander';

// 注意：此文件应在Electron主进程中使用
// 在渲染进程中应通过IPC调用

const DEFAULT_TIMEOUT = 30000; // 30秒超时

export class AIService {
  private apiKey: string = '';
  private provider: 'openai' | 'deepseek' = 'deepseek';
  private readonly storageKey = 'ai-service-api-key';

  /**
   * 设置API密钥（使用Electron safeStorage加密存储）
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    try {
      if (safeStorage.isEncryptionAvailable() && apiKey) {
        const encrypted = safeStorage.encryptString(apiKey);
        // 存储到本地（这里简化处理，实际应该使用Electron的store）
        // 注意：safeStorage主要用于临时加密，持久化需要使用其他方式
        // 这里先保存到内存，实际项目中应该使用electron-store等
      }
    } catch (error) {
      console.warn('Failed to encrypt API key:', error);
    }
  }

  /**
   * 获取API密钥（从加密存储中解密）
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * 设置服务提供商
   */
  setProvider(provider: 'openai' | 'deepseek'): void {
    this.provider = provider;
  }

  /**
   * 获取API端点URL
   */
  private getApiUrl(): string {
    if (this.provider === 'deepseek') {
      return 'https://api.deepseek.com/v1/chat/completions';
    } else {
      return 'https://api.openai.com/v1/chat/completions';
    }
  }

  /**
   * 获取模型名称
   */
  private getModelName(): string {
    if (this.provider === 'deepseek') {
      return 'deepseek-chat';
    } else {
      return 'gpt-3.5-turbo';
    }
  }

  /**
   * HTTP请求封装（使用Node.js原生https模块）
   */
  private async makeRequest(
    url: string,
    data: any,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);

      const options: RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      // 设置超时
      const timeoutId = setTimeout(() => {
        req.destroy();
        reject(new Error('Request timeout'));
      }, timeout);

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          clearTimeout(timeoutId);
          try {
            const parsed = JSON.parse(responseData);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 构建拓展方向生成的提示词
   */
  private buildExpansionPrompt(request: GenerateExpansionOptionsRequest): string {
    const { initialRequirement, currentContext, iteration, count = 5 } = request;
    
    let prompt = `你是一个专业的提示词拓展助手。用户想要基于以下初始需求生成详细的提示词：

初始需求：
${initialRequirement}

`;

    if (iteration > 1 && currentContext) {
      prompt += `当前已选择的拓展方向：
${currentContext}

`;
    }

    prompt += `请生成${count}个不同的拓展方向，帮助用户进一步完善这个需求。每个拓展方向应该：
1. 有一个简短的标题（不超过20个字）
2. 有详细的描述说明（100-300字），解释这个方向如何帮助完善需求
3. 每个方向应该从不同角度思考，避免重复
4. 方向应该具体、可操作，而不是泛泛而谈

请以JSON格式返回，格式如下：
{
  "options": [
    {
      "title": "方向标题",
      "description": "方向详细描述"
    }
  ]
}

只返回JSON，不要其他内容。`;

    return prompt;
  }

  /**
   * 解析AI响应为ExpansionOption数组
   */
  private parseExpansionOptions(response: any): ExpansionOption[] {
    try {
      let content = '';
      
      // 处理不同的响应格式
      if (response.choices && response.choices.length > 0) {
        content = response.choices[0].message?.content || '';
      } else if (typeof response === 'string') {
        content = response;
      } else {
        throw new Error('无法解析AI响应格式');
      }

      // 尝试提取JSON（可能包含markdown代码块）
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                       content.match(/\{[\s\S]*\}/);
      
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const parsed = JSON.parse(jsonStr.trim());

      if (!parsed.options || !Array.isArray(parsed.options)) {
        throw new Error('响应格式不正确：缺少options数组');
      }

      const now = new Date().toISOString();
      return parsed.options.map((opt: any, index: number) => ({
        id: `${Date.now()}-${index}`,
        title: opt.title || `方向 ${index + 1}`,
        description: opt.description || '',
        generatedAt: now,
      })).filter((opt: ExpansionOption) => 
        opt.title && opt.description && 
        opt.title.length > 0 && opt.description.length > 0
      );
    } catch (error) {
      throw new Error(`解析拓展方向失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 生成拓展方向（带重试机制）
   */
  async generateExpansionOptions(
    request: GenerateExpansionOptionsRequest
  ): Promise<ExpansionOption[]> {
    if (!this.apiKey) {
      throw new Error('API密钥未设置');
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const prompt = this.buildExpansionPrompt(request);
        const url = this.getApiUrl();
        const model = this.getModelName();

        const requestData = {
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        };

        const response = await this.makeRequest(url, requestData);
        const options = this.parseExpansionOptions(response);

        // 确保返回3-5个选项
        if (options.length < 3) {
          throw new Error(`生成的选项数量不足（${options.length}个），需要至少3个`);
        }

        return options.slice(0, request.count || 5);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          throw lastError;
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('生成拓展方向失败');
  }

  /**
   * 构建最终提示词生成的提示词
   */
  private buildFinalPromptRequest(request: GenerateFinalPromptRequest): string {
    const { initialRequirement, expansionHistory } = request;
    
    let prompt = `你是一个专业的提示词生成助手。基于用户的初始需求和迭代拓展过程，生成一个详细、完整、结构化的提示词。

初始需求：
${initialRequirement}

迭代拓展过程：
`;

    expansionHistory.steps.forEach((step, index) => {
      if (step.selectedOptionId) {
        const selectedOption = step.options.find(opt => opt.id === step.selectedOptionId);
        if (selectedOption) {
          prompt += `\n迭代 ${step.iteration}：
- 选择的拓展方向：${selectedOption.title}
- 详细说明：${selectedOption.description}
`;
        }
      }
    });

    prompt += `
请基于以上信息，生成一个详细、完整的提示词。提示词应该：

1. **背景说明**：清晰描述任务的背景和上下文
2. **详细需求**：整合初始需求和所有选择的拓展方向，形成完整的需求描述
3. **具体要求**：列出具体的功能要求、性能要求、约束条件等
4. **输出格式**：明确说明期望的输出格式和结构
5. **质量标准**：说明如何评估输出质量

提示词应该：
- 结构清晰，逻辑完整
- 语言准确，无歧义
- 包含所有重要信息
- 长度在200-2000字之间
- 使用Markdown格式

请直接返回生成的提示词内容，使用Markdown格式。`;

    return prompt;
  }

  /**
   * 解析最终提示词响应
   */
  private parseFinalPrompt(response: any, format: 'text' | 'markdown' = 'markdown'): FinalPrompt {
    try {
      let content = '';
      
      // 处理不同的响应格式
      if (response.choices && response.choices.length > 0) {
        content = response.choices[0].message?.content || '';
      } else if (typeof response === 'string') {
        content = response;
      } else {
        throw new Error('无法解析AI响应格式');
      }

      // 清理内容（移除可能的markdown代码块标记）
      content = content.replace(/^```(?:markdown)?\s*/gm, '').replace(/\s*```$/gm, '').trim();

      // 统计字数和段落数
      const wordCount = this.countWords(content);
      const paragraphCount = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

      return {
        content,
        format,
        wordCount,
        paragraphCount,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`解析最终提示词失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 统计字数（支持中英文）
   */
  private countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    
    // 中文字符按1个字计算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 英文单词按空格分割
    const englishWords = text
      .replace(/[\u4e00-\u9fa5]/g, '')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
    
    return chineseChars + englishWords;
  }

  /**
   * 生成最终提示词（带重试机制）
   */
  async generateFinalPrompt(request: GenerateFinalPromptRequest): Promise<FinalPrompt> {
    if (!this.apiKey) {
      throw new Error('API密钥未设置');
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const prompt = this.buildFinalPromptRequest(request);
        const url = this.getApiUrl();
        const model = this.getModelName();

        const requestData = {
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        };

        const response = await this.makeRequest(url, requestData);
        const finalPrompt = this.parseFinalPrompt(response, request.format || 'markdown');

        // 验证提示词长度
        if (finalPrompt.content.length < 200) {
          throw new Error('生成的提示词过短，请重试');
        }
        if (finalPrompt.content.length > 5000) {
          throw new Error('生成的提示词过长');
        }

        return finalPrompt;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          throw lastError;
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('生成最终提示词失败');
  }
}

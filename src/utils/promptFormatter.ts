/**
 * 提示词格式化工具函数
 */

import type { FinalPrompt } from '../types/prompt-expander';

/**
 * 统计字数
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  // 中文字符按1个字计算，英文单词按空格分割
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, '')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
  
  return chineseChars + englishWords;
}

/**
 * 统计段落数
 */
export function countParagraphs(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  return text
    .split(/\n\s*\n/)
    .filter(para => para.trim().length > 0).length;
}

/**
 * 格式化提示词为导出格式
 */
export function formatPromptForExport(
  prompt: FinalPrompt,
  metadata?: {
    initialRequirement: string;
    iterationCount: number;
    createdAt: string;
    includeMetadata?: boolean;
  },
  format: 'txt' | 'md' = 'md'
): string {
  let content = prompt.content;

  if (metadata && metadata.includeMetadata !== false) {
    const separator = format === 'md' ? '---' : '---';
    const metadataSection = format === 'md'
      ? `\n${separator}\n**生成时间**: ${new Date(metadata.createdAt).toLocaleString('zh-CN')}  \n**迭代次数**: ${metadata.iterationCount}  \n**初始需求**: ${metadata.initialRequirement}\n`
      : `\n${separator}\n生成时间: ${new Date(metadata.createdAt).toLocaleString('zh-CN')}\n迭代次数: ${metadata.iterationCount}\n初始需求: ${metadata.initialRequirement}\n`;

    if (format === 'md') {
      content = `# Prompt\n\n${content}${metadataSection}`;
    } else {
      content = `${content}${metadataSection}`;
    }
  }

  return content;
}

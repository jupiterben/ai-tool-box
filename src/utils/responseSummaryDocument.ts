export interface ToolResponseItem {
  toolId: string;
  toolName: string;
  content: string;
  userQuestion?: string;
  success: boolean;
  error?: string;
}

export interface ResponseSummaryDocument {
  title: string;
  generatedAt: string;
  question: string;
  markdown: string;
  summarySection: string;
  /** LLM 生成的智能汇总 Markdown */
  llmMarkdown?: string;
  llmSummarized: boolean;
  responses: ToolResponseItem[];
}

export function buildSummaryDocument(
  question: string,
  responses: ToolResponseItem[],
  llmMarkdown?: string
): ResponseSummaryDocument {
  const generatedAt = new Date().toLocaleString('zh-CN');
  const successful = responses.filter((r) => r.success && r.content);
  const failed = responses.filter((r) => !r.success || !r.content);

  const summaryLines: string[] = [
    `- 共 ${responses.length} 个 AI 工具，${successful.length} 个成功返回回复`,
  ];

  if (llmMarkdown) {
    summaryLines.push('- 已使用 LLM 生成智能汇总');
  }

  for (const item of successful) {
    const preview = item.content.replace(/\s+/g, ' ').slice(0, 120);
    summaryLines.push(`- **${item.toolName}**：${preview}${item.content.length > 120 ? '…' : ''}`);
  }

  if (failed.length) {
    summaryLines.push(`- 未获取到回复：${failed.map((f) => f.toolName).join('、')}`);
  }

  const summarySection = summaryLines.join('\n');

  const markdown = buildFullMarkdown(question, generatedAt, summarySection, responses, llmMarkdown);

  return {
    title: question ? `AI回复汇总 - ${question.slice(0, 40)}` : 'AI 回复汇总',
    generatedAt,
    question,
    markdown,
    summarySection,
    llmMarkdown,
    llmSummarized: !!llmMarkdown,
    responses,
  };
}

function buildResponsesSection(responses: ToolResponseItem[]): string {
  const bodyParts: string[] = [];

  for (const item of responses) {
    bodyParts.push(`### ${item.toolName}\n`);
    if (item.success && item.content) {
      bodyParts.push(`${item.content}\n`);
    } else {
      bodyParts.push(`> ⚠️ ${item.error || '未能提取回复，请确认页面已生成回答'}\n`);
    }
    bodyParts.push('');
  }

  return bodyParts.join('\n');
}

function buildFullMarkdown(
  question: string,
  generatedAt: string,
  summarySection: string,
  responses: ToolResponseItem[],
  llmMarkdown?: string
): string {
  const bodyParts: string[] = [
    `# AI 回复汇总`,
    ``,
    `> 生成时间：${generatedAt}`,
    ``,
    question ? `## 问题\n\n${question}\n` : '',
    llmMarkdown ? `## 结论与结果\n\n${llmMarkdown}\n` : '',
    `## 概要\n\n${summarySection}\n`,
    `## 各平台详细回复\n`,
    buildResponsesSection(responses),
  ];

  return bodyParts.filter(Boolean).join('\n');
}

/** 下载用：始终按 responses 重建，保证含全部平台原文（不仅是 LLM 结论） */
export function buildDownloadMarkdown(doc: ResponseSummaryDocument): string {
  return buildFullMarkdown(
    doc.question,
    doc.generatedAt,
    doc.summarySection,
    doc.responses,
    doc.llmMarkdown
  );
}

export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

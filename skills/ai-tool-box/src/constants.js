export const KNOWN_TOOLS = [
  { id: "gemini-image", label: "Gemini", note: "Google Gemini (default)" },
  { id: "aistudio-image", label: "Google AI Studio", note: "AI Studio Gemini Flash Image" },
  { id: "jimeng", label: "即梦 AI", note: "字节跳动即梦" },
  { id: "wanxiang", label: "通义万相", note: "阿里通义万相" },
  { id: "kling", label: "可灵 AI", note: "快手可灵" },
  { id: "liblib", label: "LiblibAI", note: "LiblibAI" },
  { id: "yige", label: "文心一格", note: "百度文心一格" },
  { id: "miaohua", label: "秒画", note: "达摩院秒画" },
  { id: "doubao-image", label: "豆包绘图", note: "字节豆包绘图" },
  { id: "midjourney", label: "Midjourney", note: "Midjourney" },
  { id: "leonardo", label: "Leonardo.ai", note: "Leonardo.ai" },
  { id: "ideogram", label: "Ideogram", note: "Ideogram" },
  { id: "firefly", label: "Adobe Firefly", note: "Adobe Firefly" },
  { id: "bing-create", label: "Bing 创建", note: "Bing Image Creator" },
  { id: "stability", label: "Stability AI", note: "Stability AI" },
  { id: "recraft", label: "Recraft", note: "Recraft" },
];

export const TOOL_IDS = new Set(KNOWN_TOOLS.map((t) => t.id));

export function resolveTools(spec) {
  if (!spec) return [];
  return String(spec)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listToolsText() {
  const w = Math.max(...KNOWN_TOOLS.map((t) => t.id.length));
  return KNOWN_TOOLS.map((t) => `  ${t.id.padEnd(w + 2)} ${t.label} — ${t.note}`).join("\n");
}
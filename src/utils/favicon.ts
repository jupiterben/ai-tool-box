/** 根据页面 URL 生成 favicon 占位图（页面加载前显示） */
export function getFaviconFallbackUrl(pageUrl: string): string {
  try {
    const { hostname } = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  } catch {
    return '';
  }
}

const FAVICON_PROXY = 'https://www.google.com/s2/favicons';

function toProxiedFaviconUrl(hostname: string): string {
  return `${FAVICON_PROXY}?domain=${encodeURIComponent(hostname)}&sz=32`;
}

/** 根据页面 URL 生成 favicon 占位图（页面加载前显示） */
export function getFaviconFallbackUrl(pageUrl: string): string {
  try {
    return toProxiedFaviconUrl(new URL(pageUrl).hostname);
  } catch {
    return '';
  }
}

/** 将 webview 上报的 favicon URL 转为 renderer 可加载的地址（避免 CORP 拦截） */
export function getLoadableFaviconUrl(faviconOrPageUrl: string): string {
  try {
    return toProxiedFaviconUrl(new URL(faviconOrPageUrl).hostname);
  } catch {
    return '';
  }
}

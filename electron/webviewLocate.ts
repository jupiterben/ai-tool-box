import { session, webContents, type WebContents } from 'electron';
import type { SiteHandlerConfig } from '../src/webview-handlers/types.js';

export function getUrlHints(config: SiteHandlerConfig): string[] {
  const hints: string[] = [];
  if (config.urlHints?.length) {
    hints.push(...config.urlHints);
  }
  if (config.urlHint && !hints.includes(config.urlHint)) {
    hints.push(config.urlHint);
  }
  return hints;
}

export function findWebContentsById(id?: number): WebContents | null {
  if (id == null || id <= 0) {
    return null;
  }
  try {
    const wc = webContents.fromId(id);
    if (wc && !wc.isDestroyed()) {
      return wc;
    }
  } catch {
    // ignore
  }
  return null;
}

export function findWebContentsByPartition(partition: string): WebContents | null {
  let targetSession;
  try {
    targetSession = session.fromPartition(partition);
  } catch {
    return null;
  }

  const matches: WebContents[] = [];
  for (const wc of webContents.getAllWebContents()) {
    if (wc.isDestroyed()) {
      continue;
    }
    try {
      if (wc.session === targetSession) {
        matches.push(wc);
      }
    } catch {
      // ignore
    }
  }

  const webviewGuest = matches.find((wc) => wc.getType() === 'webview');
  if (webviewGuest) {
    return webviewGuest;
  }
  return matches[0] ?? null;
}

export function findWebContentsByUrlHints(hints: string[]): WebContents | null {
  for (const hint of hints) {
    for (const wc of webContents.getAllWebContents()) {
      if (wc.isDestroyed()) {
        continue;
      }
      if (wc.getType() !== 'webview') {
        continue;
      }
      try {
        const url = wc.getURL();
        if (url && url.includes(hint)) {
          return wc;
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export function findToolWebContents(
  partition: string,
  webContentsId: number | undefined,
  urlHints: string[]
): WebContents | null {
  return (
    findWebContentsById(webContentsId) ??
    findWebContentsByPartition(partition) ??
    findWebContentsByUrlHints(urlHints)
  );
}

/** @deprecated 使用 findToolWebContents */
export function findWebContentsByPartitionLegacy(
  partition: string,
  urlHint?: string
): WebContents | null {
  return findToolWebContents(partition, undefined, urlHint ? [urlHint] : []);
}

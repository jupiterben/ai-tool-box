import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { mountGuest } from '../desktop/webview';

export type TauriWebViewElement = HTMLElement & {
  src?: string;
  reload?: () => void;
  goBack?: () => void;
  goForward?: () => void;
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  executeJavaScript?: (code: string) => Promise<unknown>;
  isLoading?: boolean;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
};

export interface TauriWebViewProps {
  src?: string;
  style?: CSSProperties;
  partition?: string;
  webpreferences?: string;
  'data-tool-id'?: string;
  'data-thread-id'?: string;
  'aria-label'?: string;
}

export const TauriWebView = forwardRef<TauriWebViewElement, TauriWebViewProps>(
  function TauriWebView(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const refValue = useRef(ref);
    refValue.current = ref;
    const [error, setError] = useState('');
    const src = props.src ?? '';
    const partition = props.partition;
    const toolId = props['data-tool-id'] ?? '';
    const threadId = props['data-thread-id'];
    useLayoutEffect(() => {
      if (!host.current || !isTauri()) return;
      return mountGuest(host.current, {
        src, partition, toolId, threadId,
      }, (element) => {
        const current = refValue.current;
        if (typeof current === 'function') current(element);
        else if (current) current.current = element;
      }, setError);
    }, [src, partition, toolId, threadId]);
    return <div ref={host} style={props.style} data-native-webview
      data-tool-id={props['data-tool-id']} data-thread-id={props['data-thread-id']}
      aria-label={props['aria-label']}>
      {error ? <div role="alert">{error}</div> : !isTauri() ?
        <div role="status">网站内容仅在 Tauri 桌面应用中可用</div> : null}
    </div>;
  },
);

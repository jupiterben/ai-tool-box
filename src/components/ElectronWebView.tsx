import { createElement, forwardRef, type CSSProperties } from 'react';

export type ElectronWebViewElement = HTMLElement & {
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

export interface ElectronWebViewProps {
  src?: string;
  style?: CSSProperties;
  partition?: string;
  webpreferences?: string;
  'data-tool-id'?: string;
  'aria-label'?: string;
}

/** Electron webview：allowpopups 须为字符串，React JSX 类型误标为 boolean */
export const ElectronWebView = forwardRef<ElectronWebViewElement, ElectronWebViewProps>(
  function ElectronWebView(props, ref) {
    return createElement('webview', {
      ...props,
      allowpopups: 'true',
      ref,
    });
  },
);

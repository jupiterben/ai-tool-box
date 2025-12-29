// Electron webview 标签类型定义
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      {
        src?: string;
        style?: React.CSSProperties;
        allowpopups?: string;
        webpreferences?: string;
        ref?: React.Ref<HTMLElement & { src?: string; reload?: () => void }>;
        onDidFinishLoad?: () => void;
        onDidFailLoad?: () => void;
      },
      HTMLElement & { src?: string; reload?: () => void }
    >;
  }
}

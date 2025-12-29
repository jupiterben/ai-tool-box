import React, { useEffect, useRef, useState } from 'react';

interface AIFrameProps {
  url: string;
  toolName: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

const AIFrame: React.FC<AIFrameProps> = ({ url, toolName, onLoad, onError }) => {
  const webviewRef = useRef<HTMLElement & { src?: string; reload?: () => void }>(null);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    // 重置错误状态当 URL 改变时
    setHasError(false);
    setErrorMessage('');

    const handleLoad = () => {
      setHasError(false);
      onLoad?.();
    };

    const handleError = () => {
      const error = `无法加载 ${toolName}，请检查网络连接或 URL 是否正确`;
      setHasError(true);
      setErrorMessage(error);
      onError?.(error);
    };

    // 设置超时检测
    const timeoutId = setTimeout(() => {
      if (!hasError) {
        handleError();
      }
    }, 15000);

    // 监听 webview 事件（Electron webview 使用不同的事件名称）
    const loadHandler = () => {
      clearTimeout(timeoutId);
      handleLoad();
    };
    
    const errorHandler = () => {
      clearTimeout(timeoutId);
      handleError();
    };

    // 使用 addEventListener 监听 webview 事件
    (webview as any).addEventListener('did-finish-load', loadHandler);
    (webview as any).addEventListener('did-fail-load', errorHandler);

    return () => {
      clearTimeout(timeoutId);
      (webview as any).removeEventListener('did-finish-load', loadHandler);
      (webview as any).removeEventListener('did-fail-load', errorHandler);
    };
  }, [url, toolName, onLoad, onError, hasError]);

  const handleRetry = () => {
    const webview = webviewRef.current;
    if (webview) {
      setHasError(false);
      setErrorMessage('');
      // 重新加载 webview
      if (webview.reload) {
        webview.reload();
      } else {
        webview.src = '';
        setTimeout(() => {
          if (webview) {
            webview.src = url;
          }
        }, 100);
      }
    }
  };

  if (hasError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <div style={{ color: '#666', fontSize: '1rem', marginBottom: '1.5rem' }}>
          {errorMessage}
        </div>
        <button
          onClick={handleRetry}
          style={{
            padding: '0.5rem 1.5rem',
            border: '1px solid #007bff',
            borderRadius: '4px',
            background: '#007bff',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          重试
        </button>
      </div>
    );
  }

  // 使用 webview 标签（Electron 特有，可以绕过 X-Frame-Options）
  return (
    <webview
      ref={webviewRef as any}
      src={url}
      style={{
        width: '100%',
        height: '100%',
        display: 'inline-flex',
      }}
      allowpopups="true"
      webpreferences="allowRunningInsecureContent=true, javascript=yes"
    />
  );
};

export default AIFrame;

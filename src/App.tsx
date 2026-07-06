import { useState, Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import MainLayout from './components/MainLayout';
import KeepAlivePage from './components/KeepAlivePage';
import UpdateBanner from './components/UpdateBanner';
import ImageGenBridge from './components/ImageGenBridge';
import { APP_NAVIGATE_EVENT } from './services/imageGenBridge';
import { ToolPage } from './components/Sidebar';
import styles from './styles/App.module.css';

function lazyPage(
  factory: () => Promise<{ default: ComponentType }>,
): LazyExoticComponent<ComponentType> {
  return lazy(factory);
}

const MultiWebviewTool = lazyPage(
  () => import('./components/MultiWebviewTool') as Promise<{ default: ComponentType }>,
);
const ImageWebviewTool = lazyPage(
  () => import('./components/ImageWebviewTool') as Promise<{ default: ComponentType }>,
);
const VideoWebviewTool = lazyPage(
  () => import('./components/VideoWebviewTool') as Promise<{ default: ComponentType }>,
);
const ApiWebviewPage = lazyPage(
  () => import('./components/ApiWebviewPage') as Promise<{ default: ComponentType }>,
);
const SettingsPage = lazyPage(
  () => import('./components/settings/SettingsPage') as Promise<{ default: ComponentType }>,
);

const TOOL_PAGES: ToolPage[] = [
  {
    id: 'multi-webview',
    name: '对话',
    iconName: 'Globe',
  },
  {
    id: 'image-webview',
    name: '生图',
    iconName: 'Image',
  },
  {
    id: 'video-webview',
    name: '生视频',
    iconName: 'Video',
  },
  {
    id: 'api-webview',
    name: 'API',
    iconName: 'Workflow',
  },
  {
    id: 'settings',
    name: '设置',
    iconName: 'Settings',
  },
];

const LoadingPlaceholder: React.FC = () => (
  <div className={styles.emptyPage}>
    <p>加载中...</p>
  </div>
);

const App: React.FC = () => {
  const [activePageId, setActivePageId] = useState<string>(TOOL_PAGES[0]?.id || '');
  const [visitedPageIds, setVisitedPageIds] = useState<Set<string>>(
    () => new Set([activePageId, 'image-webview'].filter(Boolean)),
  );

  useEffect(() => {
    if (!activePageId) return;
    setVisitedPageIds((prev) => {
      if (prev.has(activePageId)) return prev;
      const next = new Set(prev);
      next.add(activePageId);
      return next;
    });
  }, [activePageId]);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const pageId = (event as CustomEvent<{ pageId: string }>).detail?.pageId;
      if (pageId) {
        setActivePageId(pageId);
      }
    };
    const onEnsureVisited = (event: Event) => {
      const pageId = (event as CustomEvent<{ pageId: string }>).detail?.pageId;
      if (!pageId) return;
      setVisitedPageIds((prev) => {
        if (prev.has(pageId)) return prev;
        const next = new Set(prev);
        next.add(pageId);
        return next;
      });
    };

    window.addEventListener(APP_NAVIGATE_EVENT, onNavigate);
    window.addEventListener('app:ensure-visited', onEnsureVisited);
    return () => {
      window.removeEventListener(APP_NAVIGATE_EVENT, onNavigate);
      window.removeEventListener('app:ensure-visited', onEnsureVisited);
    };
  }, []);

  return (
    <>
      <MainLayout
        pages={TOOL_PAGES}
        activePageId={activePageId}
        onPageChange={setActivePageId}
      >
      {visitedPageIds.has('multi-webview') && (
        <KeepAlivePage id="multi-webview" active={activePageId === 'multi-webview'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <MultiWebviewTool />
          </Suspense>
        </KeepAlivePage>
      )}
      {visitedPageIds.has('image-webview') && (
        <KeepAlivePage id="image-webview" active={activePageId === 'image-webview'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <ImageWebviewTool />
          </Suspense>
        </KeepAlivePage>
      )}
      {visitedPageIds.has('video-webview') && (
        <KeepAlivePage id="video-webview" active={activePageId === 'video-webview'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <VideoWebviewTool />
          </Suspense>
        </KeepAlivePage>
      )}
      {visitedPageIds.has('api-webview') && (
        <KeepAlivePage id="api-webview" active={activePageId === 'api-webview'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <ApiWebviewPage />
          </Suspense>
        </KeepAlivePage>
      )}
      {visitedPageIds.has('settings') && (
        <KeepAlivePage id="settings" active={activePageId === 'settings'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <SettingsPage />
          </Suspense>
        </KeepAlivePage>
      )}
      </MainLayout>
      <ImageGenBridge />
      <UpdateBanner />
    </>
  );
};

export default App;

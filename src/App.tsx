import { useState, Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import MainLayout from './components/MainLayout';
import KeepAlivePage from './components/KeepAlivePage';
import UpdateBanner from './components/UpdateBanner';
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
const EnvironmentSettingsPage = lazyPage(
  () =>
    import('./components/EnvironmentSettings/EnvironmentSettingsPage') as Promise<{
      default: ComponentType;
    }>,
);
const ToolSettingsPage = lazyPage(
  () => import('./components/ToolSettings/ToolSettingsPage') as Promise<{ default: ComponentType }>,
);
const LlmSettingsPage = lazyPage(
  () => import('./components/LlmSettings/LlmSettingsPage') as Promise<{ default: ComponentType }>,
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
    id: 'llm-settings',
    name: 'LLM 设置',
    iconName: 'Sparkles',
  },
  {
    id: 'tool-settings',
    name: '网站管理',
    iconName: 'Grid',
  },
  {
    id: 'environment-settings',
    name: '网络与定位',
    iconName: 'MapPin',
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
    () => new Set(activePageId ? [activePageId] : []),
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
      {visitedPageIds.has('llm-settings') && (
        <KeepAlivePage id="llm-settings" active={activePageId === 'llm-settings'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <LlmSettingsPage />
          </Suspense>
        </KeepAlivePage>
      )}
      {visitedPageIds.has('tool-settings') && (
        <KeepAlivePage id="tool-settings" active={activePageId === 'tool-settings'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <ToolSettingsPage />
          </Suspense>
        </KeepAlivePage>
      )}
      {visitedPageIds.has('environment-settings') && (
        <KeepAlivePage id="environment-settings" active={activePageId === 'environment-settings'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <EnvironmentSettingsPage />
          </Suspense>
        </KeepAlivePage>
      )}
      </MainLayout>
      <UpdateBanner />
    </>
  );
};

export default App;

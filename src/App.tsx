import { useState, Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import MainLayout from './components/MainLayout';
import KeepAlivePage from './components/KeepAlivePage';
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
const ProxySettingsPage = lazyPage(
  () => import('./components/ProxySettings/ProxySettingsPage') as Promise<{ default: ComponentType }>,
);
const GeolocationSettingsPage = lazyPage(
  () =>
    import('./components/GeolocationSettings/GeolocationSettingsPage') as Promise<{
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
    id: 'proxy-settings',
    name: '网络代理',
    iconName: 'Settings',
  },
  {
    id: 'geolocation-settings',
    name: 'GPS 定位',
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
      {visitedPageIds.has('proxy-settings') && (
        <KeepAlivePage id="proxy-settings" active={activePageId === 'proxy-settings'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <ProxySettingsPage />
          </Suspense>
        </KeepAlivePage>
      )}
      {visitedPageIds.has('geolocation-settings') && (
        <KeepAlivePage id="geolocation-settings" active={activePageId === 'geolocation-settings'}>
          <Suspense fallback={<LoadingPlaceholder />}>
            <GeolocationSettingsPage />
          </Suspense>
        </KeepAlivePage>
      )}
    </MainLayout>
  );
};

export default App;

import { useState, Suspense, lazy } from 'react';
import MainLayout from './components/MainLayout';
import { ToolPage } from './components/Sidebar';
import styles from './styles/App.module.css';

const MultiWebviewTool = lazy(() => import('./components/MultiWebviewTool'));
const ProxySettingsPage = lazy(() => import('./components/ProxySettings/ProxySettingsPage'));

const TOOL_PAGES: ToolPage[] = [
  {
    id: 'multi-webview',
    name: '多Webview工具',
    iconName: 'Globe',
  },
  {
    id: 'proxy-settings',
    name: '网络代理',
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

  const renderActivePage = () => {
    switch (activePageId) {
      case 'multi-webview':
        return (
          <Suspense fallback={<LoadingPlaceholder />}>
            <MultiWebviewTool />
          </Suspense>
        );
      case 'proxy-settings':
        return (
          <Suspense fallback={<LoadingPlaceholder />}>
            <ProxySettingsPage />
          </Suspense>
        );
      default:
        return (
          <div className={styles.emptyPage}>
            <p>请从侧边栏选择一个工具</p>
          </div>
        );
    }
  };

  return (
    <MainLayout
      pages={TOOL_PAGES}
      activePageId={activePageId}
      onPageChange={setActivePageId}
    >
      {renderActivePage()}
    </MainLayout>
  );
};

export default App;

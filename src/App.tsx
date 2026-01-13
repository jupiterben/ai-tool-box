import { useState, Suspense, lazy } from 'react';
import MainLayout from './components/MainLayout';
import { ToolPage } from './components/Sidebar';
import styles from './styles/App.module.css';

// 懒加载组件
const MultiWebviewTool = lazy(() => import('./components/MultiWebviewTool'));
const PromptExpander = lazy(() => import('./components/PromptExpander/PromptExpander'));

// 定义工具页面列表
const TOOL_PAGES: ToolPage[] = [
  {
    id: 'multi-webview',
    name: '多Webview工具',
    iconName: 'Globe',
  },
  {
    id: 'prompt-expander',
    name: 'Prompt拓展工具',
    iconName: 'Sparkles',
  },
];

// 加载占位符组件
const LoadingPlaceholder: React.FC = () => (
  <div className={styles.emptyPage}>
    <p>加载中...</p>
  </div>
);

const App: React.FC = () => {
  const [activePageId, setActivePageId] = useState<string>(TOOL_PAGES[0]?.id || '');

  // 渲染当前选中的工具页面
  const renderActivePage = () => {
    switch (activePageId) {
      case 'multi-webview':
        return (
          <Suspense fallback={<LoadingPlaceholder />}>
            <MultiWebviewTool />
          </Suspense>
        );
      case 'prompt-expander':
        return (
          <Suspense fallback={<LoadingPlaceholder />}>
            <PromptExpander />
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

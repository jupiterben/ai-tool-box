import React, { useState } from 'react';
import MainLayout from './components/MainLayout';
import MultiWebviewTool from './components/MultiWebviewTool';
import { ToolPage } from './components/Sidebar';
import styles from './styles/App.module.css';

// 定义工具页面列表
const TOOL_PAGES: ToolPage[] = [
  {
    id: 'multi-webview',
    name: '多Webview工具',
    icon: '🌐',
  },
  // 可以在这里添加更多工具页面
  // {
  //   id: 'another-tool',
  //   name: '另一个工具',
  //   icon: '🔧',
  // },
];

const App: React.FC = () => {
  const [activePageId, setActivePageId] = useState<string>(TOOL_PAGES[0]?.id || '');

  // 渲染当前选中的工具页面
  const renderActivePage = () => {
    switch (activePageId) {
      case 'multi-webview':
        return <MultiWebviewTool />;
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

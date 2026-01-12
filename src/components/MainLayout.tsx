import React, { ReactNode } from 'react';
import Sidebar, { ToolPage } from './Sidebar';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
  pages: ToolPage[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
  children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  pages,
  activePageId,
  onPageChange,
  children,
}) => {
  return (
    <div className={styles.layout}>
      <Sidebar
        pages={pages}
        activePageId={activePageId}
        onPageChange={onPageChange}
      />
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;

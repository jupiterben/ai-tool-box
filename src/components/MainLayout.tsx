import { ReactNode, memo } from 'react';
import Sidebar, { ToolPage } from './Sidebar';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
  pages: ToolPage[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
  children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = memo(({
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
        <div className={styles.pageContainer}>{children}</div>
      </main>
    </div>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;

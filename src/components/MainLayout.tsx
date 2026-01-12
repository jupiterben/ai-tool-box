import { ReactNode, memo } from 'react';
import { CSSTransition } from 'react-transition-group';
import Sidebar, { ToolPage } from './Sidebar';
import styles from './MainLayout.module.css';
import '../styles/transitions.css';

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
        <CSSTransition
          key={activePageId}
          in={true}
          timeout={200}
          classNames="page-transition"
          unmountOnExit
        >
          <div className={styles.pageContent}>{children}</div>
        </CSSTransition>
      </main>
    </div>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;

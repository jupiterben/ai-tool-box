import { memo, useState, useEffect } from 'react';
import Icon from './ui/Icon';
import ThemeToggle from './ThemeToggle';
import styles from './Sidebar.module.css';

export interface ToolPage {
  id: string;
  name: string;
  icon?: string;
  iconName?: 'Globe' | 'Settings' | 'Zap' | 'Layout' | 'Grid' | 'Code' | 'Sparkles';
}

interface SidebarProps {
  pages: ToolPage[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = memo(({ pages, activePageId, onPageChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 监听窗口大小变化，自动折叠
  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024);
    };

    // 初始检查
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        {!isCollapsed && <h2 className={styles.title}>工具集</h2>}
        <button
          className={styles.toggleButton}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          aria-expanded={!isCollapsed}
          aria-controls="sidebar-navigation"
        >
          <Icon name={isCollapsed ? 'Menu' : 'X'} size={20} aria-hidden="true" />
        </button>
      </div>
      {!isCollapsed && (
        <>
          <nav id="sidebar-navigation" className={styles.nav} role="navigation" aria-label="工具导航">
            {pages.map((page) => (
              <button
                key={page.id}
                className={`${styles.navItem} ${activePageId === page.id ? styles.active : ''}`}
                onClick={() => onPageChange(page.id)}
                aria-label={`切换到 ${page.name}`}
                aria-current={activePageId === page.id ? 'page' : undefined}
              >
            {page.iconName ? (
              <Icon name={page.iconName} size={20} className={styles.icon} aria-hidden="true" />
            ) : page.icon ? (
              <span className={styles.icon} aria-hidden="true">{page.icon}</span>
            ) : null}
                <span className={styles.name}>{page.name}</span>
              </button>
            ))}
          </nav>
          <div className={styles.footer}>
            <ThemeToggle />
          </div>
        </>
      )}
      {isCollapsed && (
        <div className={styles.footer}>
          <ThemeToggle />
        </div>
      )}
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;

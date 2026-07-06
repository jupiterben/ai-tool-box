import { memo, useState, useEffect } from 'react';
import Icon from './ui/Icon';
import styles from './Sidebar.module.css';

export interface ToolPage {
  id: string;
  name: string;
  icon?: string;
  iconName?: 'Globe' | 'Settings' | 'Zap' | 'Layout' | 'Grid' | 'Code' | 'Sparkles' | 'MapPin' | 'Image' | 'Video' | 'Workflow';
}

interface SidebarProps {
  pages: ToolPage[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = memo(({ pages, activePageId, onPageChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const settingsPage = pages.find((page) => page.id === 'settings');
  const navPages = pages.filter((page) => page.id !== 'settings');

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo} aria-hidden="true">
            <Icon name="Sparkles" size={18} />
          </div>
          {!isCollapsed && (
            <div className={styles.brandText}>
              <h2 className={styles.title}>AI Tool Box</h2>
              <span className={styles.subtitle}>工具集</span>
            </div>
          )}
        </div>
      </div>

      <nav id="sidebar-navigation" className={styles.nav} role="navigation" aria-label="工具导航">
        {navPages.map((page) => (
          <button
            key={page.id}
            className={`${styles.navItem} ${activePageId === page.id ? styles.active : ''}`}
            onClick={() => onPageChange(page.id)}
            aria-label={`切换到 ${page.name}`}
            aria-current={activePageId === page.id ? 'page' : undefined}
            title={isCollapsed ? page.name : undefined}
          >
            {page.iconName ? (
              <Icon name={page.iconName} size={20} className={styles.icon} aria-hidden="true" />
            ) : page.icon ? (
              <span className={styles.icon} aria-hidden="true">{page.icon}</span>
            ) : null}
            {!isCollapsed && <span className={styles.name}>{page.name}</span>}
          </button>
        ))}
      </nav>

      <div className={styles.footer}>
        {settingsPage && (
          <button
            className={`${styles.footerNavButton} ${
              activePageId === settingsPage.id ? styles.footerNavButtonActive : ''
            }`}
            onClick={() => onPageChange(settingsPage.id)}
            aria-label={`切换到${settingsPage.name}`}
            aria-current={activePageId === settingsPage.id ? 'page' : undefined}
            title={isCollapsed ? settingsPage.name : undefined}
          >
            {settingsPage.iconName ? (
              <Icon name={settingsPage.iconName} size={20} className={styles.icon} aria-hidden="true" />
            ) : settingsPage.icon ? (
              <span className={styles.icon} aria-hidden="true">{settingsPage.icon}</span>
            ) : null}
            {!isCollapsed && <span className={styles.name}>{settingsPage.name}</span>}
          </button>
        )}
        <button
          className={styles.collapseButton}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          aria-expanded={!isCollapsed}
          aria-controls="sidebar-navigation"
          title={isCollapsed ? '展开' : '折叠'}
        >
          <Icon name={isCollapsed ? 'ChevronRight' : 'ChevronLeft'} size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;

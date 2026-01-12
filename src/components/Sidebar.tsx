import React from 'react';
import styles from './Sidebar.module.css';

export interface ToolPage {
  id: string;
  name: string;
  icon?: string;
}

interface SidebarProps {
  pages: ToolPage[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ pages, activePageId, onPageChange }) => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>工具集</h2>
      </div>
      <nav className={styles.nav}>
        {pages.map((page) => (
          <button
            key={page.id}
            className={`${styles.navItem} ${activePageId === page.id ? styles.active : ''}`}
            onClick={() => onPageChange(page.id)}
            aria-label={`切换到 ${page.name}`}
          >
            {page.icon && <span className={styles.icon}>{page.icon}</span>}
            <span className={styles.name}>{page.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

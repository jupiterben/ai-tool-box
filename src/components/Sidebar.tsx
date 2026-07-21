import { memo, useCallback, useEffect, useState } from 'react';
import Icon from './ui/Icon';
import { usePresetId } from '../hooks/usePresetContext';
import { DEFAULT_PRESET_ID } from '../types/preset';
import styles from './Sidebar.module.css';

export interface ToolPage {
  id: string;
  name: string;
  icon?: string;
  iconName?:
    | 'Globe'
    | 'Settings'
    | 'Zap'
    | 'Layout'
    | 'Grid'
    | 'Code'
    | 'Sparkles'
    | 'MapPin'
    | 'Image'
    | 'Video'
    | 'Workflow';
}

interface SidebarProps {
  pages: ToolPage[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = memo(({ pages, activePageId, onPageChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [presetName, setPresetName] = useState('默认');
  const presetId = usePresetId();
  const settingsPage = pages.find((page) => page.id === 'settings');
  const navPages = pages.filter((page) => page.id !== 'settings');

  const refreshPresetName = useCallback(async () => {
    const result = await window.electronAPI?.listPresets?.();
    if (result?.success && result.presets) {
      const current = result.presets.find((p) => p.id === presetId);
      setPresetName(current?.name ?? (presetId === DEFAULT_PRESET_ID ? '默认' : presetId));
      return;
    }
    setPresetName(presetId === DEFAULT_PRESET_ID ? '默认' : presetId);
  }, [presetId]);

  useEffect(() => {
    void refreshPresetName();
  }, [refreshPresetName]);

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openPresetSettings = () => {
    sessionStorage.setItem('ai-tool-box-settings-tab', 'presets');
    if (settingsPage) {
      onPageChange(settingsPage.id);
    }
  };

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
              <span className={styles.icon} aria-hidden="true">
                {page.icon}
              </span>
            ) : null}
            {!isCollapsed && <span className={styles.name}>{page.name}</span>}
          </button>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.presetLabel}
          onClick={openPresetSettings}
          title={`当前 Preset：${presetName}`}
          aria-label={`当前 Preset ${presetName}，打开管理`}
        >
          {!isCollapsed && <span className={styles.presetLabelText}>{presetName}</span>}
          {isCollapsed && <Icon name="Layers" size={16} aria-hidden="true" />}
        </button>
        {settingsPage && (
          <button
            type="button"
            className={`${styles.settingsIconButton} ${
              activePageId === settingsPage.id ? styles.settingsIconButtonActive : ''
            }`}
            onClick={openPresetSettings}
            aria-label="设置"
            aria-current={activePageId === settingsPage.id ? 'page' : undefined}
            title="设置"
          >
            <Icon name="Settings" size={20} aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Icon from './ui/Icon';
import { usePresetId } from '../hooks/usePresetContext';
import { DEFAULT_PRESET_ID, type PresetMeta } from '../types/preset';
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
    | 'Workflow'
    | 'TerminalSquare';
}

interface SidebarProps {
  pages: ToolPage[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = memo(({ pages, activePageId, onPageChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presetId = usePresetId();
  const footerRef = useRef<HTMLDivElement>(null);
  const settingsPage = pages.find((page) => page.id === 'settings');
  const navPages = pages.filter((page) => page.id !== 'settings');

  const refreshPresets = useCallback(async () => {
    const result = await window.electronAPI?.listPresets?.();
    if (result?.success && result.presets) {
      setPresets(result.presets);
      setOpenIds(result.openIds ?? []);
    }
  }, []);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!footerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const currentName =
    presets.find((p) => p.id === presetId)?.name ??
    (presetId === DEFAULT_PRESET_ID ? '默认' : presetId);

  const openPresetSettings = () => {
    setMenuOpen(false);
    sessionStorage.setItem('ai-tool-box-settings-tab', 'presets');
    if (settingsPage) {
      onPageChange(settingsPage.id);
    }
  };

  const openSettings = () => {
    setMenuOpen(false);
    if (settingsPage) {
      onPageChange(settingsPage.id);
    }
  };

  const handleSwitch = async (id: string) => {
    setError(null);
    if (id === presetId) {
      setMenuOpen(false);
      return;
    }
    if (!window.electronAPI?.openPreset) {
      setError('切换不可用，请重启应用');
      return;
    }
    setBusy(true);
    try {
      const result = await window.electronAPI.openPreset(id);
      if (!result.success) {
        setError(result.error ?? '切换失败');
        return;
      }
      setMenuOpen(false);
      await refreshPresets();
    } finally {
      setBusy(false);
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

      <div className={styles.footer} ref={footerRef}>
        <div className={styles.presetSwitch}>
          <button
            type="button"
            className={styles.presetLabel}
            onClick={() => {
              setError(null);
              setMenuOpen((open) => !open);
              void refreshPresets();
            }}
            title={`当前 Preset：${currentName}`}
            aria-label={`当前 Preset ${currentName}，快捷切换`}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            disabled={busy}
          >
            {!isCollapsed && (
              <>
                <span className={styles.presetLabelText}>{currentName}</span>
                <Icon name="ChevronDown" size={14} aria-hidden="true" />
              </>
            )}
            {isCollapsed && <Icon name="Layers" size={16} aria-hidden="true" />}
          </button>

          {menuOpen && (
            <div className={styles.presetMenu} role="listbox">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`${styles.presetMenuItem} ${
                    preset.id === presetId ? styles.presetMenuItemActive : ''
                  }`}
                  role="option"
                  aria-selected={preset.id === presetId}
                  disabled={busy}
                  onClick={() => void handleSwitch(preset.id)}
                >
                  <span>{preset.name}</span>
                  {openIds.includes(preset.id) && (
                    <span className={styles.presetBadge}>已打开</span>
                  )}
                </button>
              ))}
              <div className={styles.presetMenuDivider} />
              <button
                type="button"
                className={styles.presetMenuItem}
                disabled={busy}
                onClick={openPresetSettings}
              >
                管理 Preset…
              </button>
            </div>
          )}
          {error && <p className={styles.presetError}>{error}</p>}
        </div>

        {settingsPage && (
          <button
            type="button"
            className={`${styles.settingsIconButton} ${
              activePageId === settingsPage.id ? styles.settingsIconButtonActive : ''
            }`}
            onClick={openSettings}
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

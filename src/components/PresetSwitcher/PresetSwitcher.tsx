import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PRESET_ID, type PresetMeta } from '../../types/preset';
import { usePresetId } from '../../hooks/usePresetContext';
import Icon from '../ui/Icon';
import styles from './PresetSwitcher.module.css';

interface PresetSwitcherProps {
  onManage?: () => void;
  collapsed?: boolean;
}

const PresetSwitcher: React.FC<PresetSwitcherProps> = ({ onManage, collapsed }) => {
  const currentId = usePresetId();
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.listPresets) return;
    const result = await window.electronAPI.listPresets();
    if (result.success && result.presets) {
      setPresets(result.presets);
      setOpenIds(result.openIds ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = presets.find((p) => p.id === currentId) ?? {
    id: currentId,
    name: currentId === DEFAULT_PRESET_ID ? '默认' : currentId,
    createdAt: 0,
  };

  const handleOpen = async (id: string) => {
    setMenuOpen(false);
    if (id === currentId) return;
    const result = await window.electronAPI?.openPreset(id);
    if (!result?.success) {
      setError(result?.error ?? '打开失败');
    }
  };

  const handleCreate = async () => {
    setMenuOpen(false);
    const name = window.prompt('新 Preset 名称');
    if (!name?.trim()) return;
    const created = await window.electronAPI?.createPreset(name.trim());
    if (!created?.success || !created.preset) {
      setError(created?.error ?? '创建失败');
      return;
    }
    await window.electronAPI?.openPreset(created.preset.id);
    await refresh();
  };

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.collapsedButton}
        title={`Preset: ${current.name}`}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={`当前 Preset ${current.name}`}
      >
        <Icon name="Layers" size={18} />
      </button>
    );
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
      >
        <Icon name="Layers" size={16} />
        <span className={styles.triggerLabel}>{current.name}</span>
        <Icon name="ChevronDown" size={14} />
      </button>
      {menuOpen && (
        <div className={styles.menu} role="listbox">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`${styles.item} ${preset.id === currentId ? styles.itemActive : ''}`}
              onClick={() => void handleOpen(preset.id)}
              role="option"
              aria-selected={preset.id === currentId}
            >
              <span>{preset.name}</span>
              {openIds.includes(preset.id) && <span className={styles.badge}>已打开</span>}
            </button>
          ))}
          <div className={styles.divider} />
          <button type="button" className={styles.item} onClick={() => void handleCreate()}>
            新建 Preset…
          </button>
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              setMenuOpen(false);
              onManage?.();
            }}
          >
            管理 Preset…
          </button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

export default PresetSwitcher;

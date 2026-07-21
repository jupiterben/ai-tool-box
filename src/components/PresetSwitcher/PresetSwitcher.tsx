import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.listPresets) {
      setError('Preset API 不可用，请重启应用');
      return;
    }
    const result = await window.electronAPI.listPresets();
    if (result.success && result.presets) {
      setPresets(result.presets);
      setOpenIds(result.openIds ?? []);
    } else if (!result.success) {
      setError(result.error ?? '读取 Preset 失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (creating) {
      inputRef.current?.focus();
    }
  }, [creating]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setCreating(false);
        setDraftName('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const current = presets.find((p) => p.id === currentId) ?? {
    id: currentId,
    name: currentId === DEFAULT_PRESET_ID ? '默认' : currentId,
    createdAt: 0,
  };

  const handleOpen = async (id: string) => {
    setMenuOpen(false);
    setCreating(false);
    setError(null);
    if (id === currentId) return;
    if (!window.electronAPI?.openPreset) {
      setError('打开 API 不可用，请重启应用');
      return;
    }
    setBusy(true);
    try {
      const result = await window.electronAPI.openPreset(id);
      if (!result.success) {
        setError(result.error ?? '打开失败');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const name = draftName.trim();
    if (!name) {
      setError('请输入 Preset 名称');
      return;
    }
    if (!window.electronAPI?.createPreset || !window.electronAPI?.openPreset) {
      setError('Preset API 不可用，请重启应用');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await window.electronAPI.createPreset(name);
      if (!created.success || !created.preset) {
        setError(created.error ?? '创建失败');
        return;
      }
      const opened = await window.electronAPI.openPreset(created.preset.id);
      if (!opened.success) {
        setError(opened.error ?? `已创建「${created.preset.name}」，但打开窗口失败`);
      }
      setDraftName('');
      setCreating(false);
      setMenuOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const menu = menuOpen && (
    <div className={styles.menu} role="listbox">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`${styles.item} ${preset.id === currentId ? styles.itemActive : ''}`}
          onClick={() => void handleOpen(preset.id)}
          role="option"
          aria-selected={preset.id === currentId}
          disabled={busy}
        >
          <span>{preset.name}</span>
          {openIds.includes(preset.id) && <span className={styles.badge}>已打开</span>}
        </button>
      ))}
      <div className={styles.divider} />
      {creating ? (
        <div className={styles.createRow}>
          <input
            ref={inputRef}
            className={styles.createInput}
            value={draftName}
            placeholder="输入名称，回车创建"
            disabled={busy}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreate();
              }
              if (e.key === 'Escape') {
                setCreating(false);
                setDraftName('');
              }
            }}
          />
          <button
            type="button"
            className={styles.createSubmit}
            disabled={busy || !draftName.trim()}
            onClick={() => void handleCreate()}
          >
            创建
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.item}
          disabled={busy}
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
        >
          新建 Preset…
        </button>
      )}
      <button
        type="button"
        className={styles.item}
        disabled={busy}
        onClick={() => {
          setMenuOpen(false);
          setCreating(false);
          onManage?.();
        }}
      >
        管理 Preset…
      </button>
    </div>
  );

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {collapsed ? (
        <button
          type="button"
          className={styles.collapsedButton}
          title={`Preset: ${current.name}`}
          onClick={() => {
            setMenuOpen((v) => !v);
            setCreating(false);
          }}
          aria-label={`当前 Preset ${current.name}`}
          aria-expanded={menuOpen}
        >
          <Icon name="Layers" size={18} />
        </button>
      ) : (
        <button
          type="button"
          className={styles.trigger}
          onClick={() => {
            setMenuOpen((v) => !v);
            setCreating(false);
          }}
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          disabled={busy}
        >
          <Icon name="Layers" size={16} />
          <span className={styles.triggerLabel}>{current.name}</span>
          <Icon name="ChevronDown" size={14} />
        </button>
      )}
      {menu}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

export default PresetSwitcher;

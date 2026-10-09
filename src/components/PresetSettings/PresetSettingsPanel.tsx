import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PRESET_ID, type PresetMeta } from '../../types/preset';
import { usePresetId } from '../../hooks/usePresetContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import styles from './PresetSettingsPanel.module.css';

const PresetSettingsPanel: React.FC = () => {
  const currentId = usePresetId();
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.listPresets) {
      setError('Preset API 不可用，请重启应用');
      return;
    }
    const result = await window.electronAPI.listPresets();
    if (result?.success && result.presets) {
      setPresets(result.presets);
      setOpenIds(result.openIds ?? []);
    } else {
      setError(result?.error ?? '读取 Preset 失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    setError(null);
    setMessage(null);
    const name = newName.trim();
    if (!name) {
      setError('请输入 Preset 名称');
      return;
    }
    if (!window.electronAPI?.createPreset) {
      setError('创建 API 不可用，请重启应用');
      return;
    }
    setBusy(true);
    try {
      const result = await window.electronAPI.createPreset(name);
      if (!result?.success || !result.preset) {
        setError(result?.error ?? '创建失败');
        return;
      }
      setNewName('');
      setMessage(`已创建「${result.preset.name}」`);
      await refresh();
      const opened = await window.electronAPI.openPreset?.(result.preset.id);
      if (opened && !opened.success) {
        setError(opened.error ?? '创建成功，但打开窗口失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleRenameSave = async () => {
    if (!renameId) return;
    const next = renameValue.trim();
    if (!next) {
      setError('名称不能为空');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.electronAPI?.renamePreset(renameId, next);
      if (!result?.success) {
        setError(result?.error ?? '重命名失败');
        return;
      }
      setRenameId(null);
      setRenameValue('');
      setMessage('已重命名');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (id === DEFAULT_PRESET_ID) return;
    if (!window.confirm(`确定删除 Preset「${name}」？登录态与设置将被清除。`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.electronAPI?.deletePreset(id);
      if (!result?.success) {
        setError(result?.error ?? '删除失败');
        return;
      }
      setMessage(`已删除「${name}」`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.electronAPI?.openPreset(id);
      if (!result?.success) {
        setError(result?.error ?? '打开失败');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <Alert variant="info">
        切换 Preset 会新开窗口（每个 Preset 最多一窗）。同 Preset 内站点共享登录态与上游代理；按站分流请在本机
        Clash 等代理中配置规则。
      </Alert>

      <div className={styles.createRow}>
        <Input
          label="新建名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="例如：工作"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <Button onClick={() => void handleCreate()} disabled={busy || !newName.trim()}>
          创建并打开
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div className={styles.list}>
        {presets.map((preset) => (
          <article key={preset.id} className={styles.card}>
            <div className={styles.cardMain}>
              {renameId === preset.id ? (
                <Input
                  label="重命名"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRenameSave();
                    }
                    if (e.key === 'Escape') {
                      setRenameId(null);
                    }
                  }}
                />
              ) : (
                <>
                  <strong>
                    {preset.name}
                    {preset.id === currentId ? '（本窗）' : ''}
                  </strong>
                  <span className={styles.meta}>
                    {openIds.includes(preset.id) ? '已打开' : '未打开'}
                  </span>
                </>
              )}
            </div>
            <div className={styles.actions}>
              {renameId === preset.id ? (
                <>
                  <Button size="sm" onClick={() => void handleRenameSave()} disabled={busy}>
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRenameId(null)}
                    disabled={busy}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleOpen(preset.id)}
                    disabled={busy}
                  >
                    打开
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRenameId(preset.id);
                      setRenameValue(preset.name);
                    }}
                    disabled={busy}
                  >
                    重命名
                  </Button>
                  {preset.id !== DEFAULT_PRESET_ID && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(preset.id, preset.name)}
                      disabled={busy}
                    >
                      删除
                    </Button>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default PresetSettingsPanel;

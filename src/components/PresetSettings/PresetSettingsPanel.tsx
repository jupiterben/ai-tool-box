import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PRESET_ID, type PresetMeta } from '../../types/preset';
import { usePresetId } from '../../hooks/usePresetContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { settingsStyles } from '../settings/SettingsPageLayout';

const PresetSettingsPanel: React.FC = () => {
  const currentId = usePresetId();
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await window.electronAPI?.listPresets();
    if (result?.success && result.presets) {
      setPresets(result.presets);
      setOpenIds(result.openIds ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    setError(null);
    setMessage(null);
    const result = await window.electronAPI?.createPreset(newName);
    if (!result?.success) {
      setError(result?.error ?? '创建失败');
      return;
    }
    setNewName('');
    setMessage(`已创建「${result.preset?.name}」`);
    await refresh();
  };

  const handleRename = async (id: string, name: string) => {
    const next = window.prompt('重命名 Preset', name);
    if (!next?.trim() || next.trim() === name) return;
    const result = await window.electronAPI?.renamePreset(id, next.trim());
    if (!result?.success) {
      setError(result?.error ?? '重命名失败');
      return;
    }
    await refresh();
  };

  const handleDelete = async (id: string, name: string) => {
    if (id === DEFAULT_PRESET_ID) return;
    if (!window.confirm(`确定删除 Preset「${name}」？登录态与设置将被清除。`)) return;
    const result = await window.electronAPI?.deletePreset(id);
    if (!result?.success) {
      setError(result?.error ?? '删除失败');
      return;
    }
    await refresh();
  };

  const handleOpen = async (id: string) => {
    await window.electronAPI?.openPreset(id);
    await refresh();
  };

  return (
    <div>
      <Alert variant="info">
        切换 Preset 会新开窗口（每个 Preset 最多一窗）。同 Preset 内站点共享登录态与上游代理；按站分流请在本机 Clash 等代理中配置规则。
      </Alert>

      <div className={settingsStyles.toolbar} style={{ marginTop: 16, gap: 8, display: 'flex' }}>
        <Input
          label="新建名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="例如：工作"
        />
        <Button onClick={() => void handleCreate()} disabled={!newName.trim()}>
          创建
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <table className={settingsStyles.table} style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>名称</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <tr key={preset.id}>
              <td>
                {preset.name}
                {preset.id === currentId ? '（本窗）' : ''}
              </td>
              <td>{openIds.includes(preset.id) ? '已打开' : '未打开'}</td>
              <td style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="outline" onClick={() => void handleOpen(preset.id)}>
                  打开
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRename(preset.id, preset.name)}
                >
                  重命名
                </Button>
                {preset.id !== DEFAULT_PRESET_ID && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDelete(preset.id, preset.name)}
                  >
                    删除
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PresetSettingsPanel;

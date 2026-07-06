import { useCallback, useEffect, useState } from 'react';
import { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';
import type { ImageGenApiSettings, ImageGenApiStatus } from '../../types/image-gen-api-settings';

const DEFAULT_SETTINGS: ImageGenApiSettings = {
  version: '1.0.0',
  enabled: true,
  port: 3920,
};

const ApiSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<ImageGenApiSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<ImageGenApiStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!window.electronAPI?.getImageGenApiSettings) {
      setError('当前环境不支持 API 设置');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getImageGenApiSettings();
      if (!result.success || !result.settings) {
        setError(result.error || '读取 API 设置失败');
        return;
      }
      setSettings(result.settings);
      setStatus(result.status ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取 API 设置失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback((patch: Partial<ImageGenApiSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaveMessage(null);
  }, []);

  const saveSettings = useCallback(async () => {
    if (!window.electronAPI?.saveImageGenApiSettings) {
      setError('当前环境不支持 API 设置');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const result = await window.electronAPI.saveImageGenApiSettings(settings);
      if (!result.success || !result.settings) {
        setError(result.error || '保存 API 设置失败');
        if (result.status) setStatus(result.status);
        return;
      }

      setSettings(result.settings);
      setStatus(result.status ?? null);
      setSaveMessage(result.status?.running
        ? `API 服务已启动，实际端口 ${result.status.actualPort}`
        : 'API 服务已关闭');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 API 设置失败');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  if (isLoading) {
    return <SettingsLoading message="加载 API 设置..." />;
  }

  const actualPortChanged =
    status?.running && status.actualPort && status.actualPort !== settings.port;

  return (
    <>
      <section className={settingsStyles.card}>
        <div className={settingsStyles.sectionHeader}>
          <div>
            <h2 className={settingsStyles.sectionTitle}>生图 API 服务</h2>
            <p className={settingsStyles.hint}>
              控制本机 HTTP API 是否随应用启动，并设置首选监听端口。
            </p>
          </div>
          <Toggle
            label="启用 API 服务"
            checked={settings.enabled}
            onChange={(event) => updateSettings({ enabled: event.target.checked })}
          />
        </div>

        <div className={settingsStyles.fieldGroup}>
          <label className={settingsStyles.label} htmlFor="image-api-port">
            首选端口
          </label>
          <Input
            id="image-api-port"
            type="number"
            min={1}
            max={65535}
            step={1}
            value={String(settings.port)}
            onChange={(event) => updateSettings({ port: Number(event.target.value) })}
            helperText="如果端口被占用，服务会自动尝试后续端口。"
          />
        </div>

        <div className={settingsStyles.fieldGroup}>
          <span className={settingsStyles.label}>当前状态</span>
          <p className={settingsStyles.hint}>
            {status?.running
              ? `运行中：${status.host}:${status.actualPort}`
              : settings.enabled
                ? '未运行'
                : '已关闭'}
          </p>
          {actualPortChanged && (
            <p className={settingsStyles.hint}>
              首选端口 {settings.port} 被占用，已自动使用 {status?.actualPort}。
            </p>
          )}
          {status?.accessUrls.length ? (
            <div className={settingsStyles.fieldGroup}>
              {status.accessUrls.map((url) => (
                <code key={url} className={settingsStyles.hint}>
                  {url}
                </code>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {error && <Alert variant="error">{error}</Alert>}
      {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

      <div className={settingsStyles.actions}>
        <Button onClick={() => void saveSettings()} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存并应用'}
        </Button>
        <Button variant="outline" onClick={() => void loadSettings()} disabled={isSaving}>
          刷新状态
        </Button>
      </div>
    </>
  );
};

export default ApiSettingsPanel;

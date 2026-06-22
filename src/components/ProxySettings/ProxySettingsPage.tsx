import { useMemo } from 'react';
import { DEFAULT_TOOLS } from '../../config/tools';
import { useProxySettings } from '../../hooks/useProxySettings';
import type { ProxyMode, ProxyProtocol } from '../../types/proxy-settings';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import styles from './ProxySettingsPage.module.css';

const MODE_OPTIONS: { value: ProxyMode; label: string }[] = [
  { value: 'direct', label: '直连' },
  { value: 'system', label: '系统代理' },
  { value: 'manual', label: '自定义代理' },
];

const PROTOCOL_OPTIONS: { value: ProxyProtocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks5', label: 'SOCKS5' },
];

const ProxySettingsPage: React.FC = () => {
  const {
    settings,
    isLoading,
    isSaving,
    error,
    saveMessage,
    loadSettings,
    updateToolConfig,
    saveSettings,
  } = useProxySettings();

  const webviewTools = useMemo(
    () => DEFAULT_TOOLS.filter((tool) => Boolean(tool.url)),
    []
  );

  if (isLoading) {
    return <div className={styles.loading}>加载代理设置...</div>;
  }

  return (
    <div className={styles.proxySettings} role="main" aria-label="网络代理设置">
      <header className={styles.header}>
        <h1 className={styles.title}>网络代理设置</h1>
        <p className={styles.description}>
          为每个网站单独配置网络环境。保存后对应 Webview 将重新加载并应用新代理。
        </p>
      </header>

      {webviewTools.map((tool) => {
        const config = settings.tools[tool.id] ?? { toolId: tool.id, mode: 'system' as const };

        return (
          <section key={tool.id} className={styles.toolCard} aria-label={`${tool.name} 代理设置`}>
            <div className={styles.toolHeader}>
              <h2 className={styles.toolName}>{tool.name}</h2>
              <p className={styles.toolUrl}>{tool.url}</p>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.label}>网络模式</span>
              <div className={styles.modeOptions} role="group" aria-label={`${tool.name} 网络模式`}>
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.modeButton} ${
                      config.mode === option.value ? styles.modeButtonActive : ''
                    }`}
                    onClick={() => updateToolConfig(tool.id, { mode: option.value })}
                    aria-pressed={config.mode === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {config.mode === 'manual' && (
              <div className={styles.manualFields}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor={`${tool.id}-protocol`}>
                    协议
                  </label>
                  <select
                    id={`${tool.id}-protocol`}
                    className={styles.select}
                    value={config.protocol || 'http'}
                    onChange={(event) =>
                      updateToolConfig(tool.id, {
                        protocol: event.target.value as ProxyProtocol,
                      })
                    }
                  >
                    {PROTOCOL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="主机"
                  placeholder="127.0.0.1"
                  value={config.host || ''}
                  onChange={(event) => updateToolConfig(tool.id, { host: event.target.value })}
                />
                <Input
                  label="端口"
                  placeholder="7890"
                  value={config.port || ''}
                  onChange={(event) => updateToolConfig(tool.id, { port: event.target.value })}
                />
                <Input
                  label="用户名（可选）"
                  value={config.username || ''}
                  onChange={(event) => updateToolConfig(tool.id, { username: event.target.value })}
                  autoComplete="off"
                />
                <Input
                  label="密码（可选）"
                  type="password"
                  value={config.password || ''}
                  onChange={(event) => updateToolConfig(tool.id, { password: event.target.value })}
                  autoComplete="off"
                />
              </div>
            )}
          </section>
        );
      })}

      <footer className={styles.footer}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {saveMessage && <p className={styles.message}>{saveMessage}</p>}
        <div className={styles.actions}>
          <Button onClick={() => void saveSettings()} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存并应用'}
          </Button>
          <Button variant="outline" onClick={() => void loadSettings()} disabled={isSaving}>
            重新加载
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ProxySettingsPage;

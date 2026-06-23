import { useMemo } from 'react';
import { DEFAULT_TOOLS } from '../../config/tools';
import { useProxySettings } from '../../hooks/useProxySettings';
import type { ProxyMode, ProxyProtocol } from '../../types/proxy-settings';
import { formatProxyProfile } from '../../types/proxy-settings';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import styles from './ProxySettingsPage.module.css';

const MODE_OPTIONS: { value: ProxyMode; label: string }[] = [
  { value: 'direct', label: '直连' },
  { value: 'system', label: '系统代理' },
  { value: 'profile', label: '使用代理' },
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
    addProfile,
    updateProfile,
    removeProfile,
    saveSettings,
  } = useProxySettings();

  const webviewTools = useMemo(
    () => DEFAULT_TOOLS.filter((tool) => Boolean(tool.url)),
    []
  );

  const profileList = useMemo(
    () => Object.values(settings.profiles),
    [settings.profiles]
  );

  if (isLoading) {
    return <div className={styles.loading}>加载代理设置...</div>;
  }

  return (
    <div className={styles.proxySettings} role="main" aria-label="网络代理设置">
      <header className={styles.header}>
        <h1 className={styles.title}>网络代理设置</h1>
        <p className={styles.description}>
          先在代理库中定义代理，再为各网站选择网络环境。修改后会自动保存并应用到 Webview。
        </p>
      </header>

      <section className={styles.section} aria-label="代理库">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>代理库</h2>
          <Button variant="outline" onClick={addProfile} disabled={isSaving}>
            添加代理
          </Button>
        </div>

        {profileList.length === 0 ? (
          <p className={styles.emptyHint}>暂无代理，点击「添加代理」创建第一条。</p>
        ) : (
          <div className={styles.profileList}>
            {profileList.map((profile) => (
              <article key={profile.id} className={styles.profileCard} aria-label={`代理 ${profile.name}`}>
                <div className={styles.profileCardHeader}>
                  <Input
                    label="名称"
                    placeholder="例如：本地 Clash"
                    value={profile.name}
                    onChange={(event) =>
                      updateProfile(profile.id, { name: event.target.value })
                    }
                  />
                  <Button
                    variant="outline"
                    className={styles.deleteButton}
                    onClick={() => removeProfile(profile.id)}
                    disabled={isSaving}
                  >
                    删除
                  </Button>
                </div>

                <div className={styles.manualFields}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor={`${profile.id}-protocol`}>
                      协议
                    </label>
                    <select
                      id={`${profile.id}-protocol`}
                      className={styles.select}
                      value={profile.protocol || 'http'}
                      onChange={(event) =>
                        updateProfile(profile.id, {
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
                    value={profile.host || ''}
                    onChange={(event) =>
                      updateProfile(profile.id, { host: event.target.value })
                    }
                  />
                  <Input
                    label="端口"
                    placeholder="7890"
                    value={profile.port || ''}
                    onChange={(event) =>
                      updateProfile(profile.id, { port: event.target.value })
                    }
                  />
                  <Input
                    label="用户名（可选）"
                    value={profile.username || ''}
                    onChange={(event) =>
                      updateProfile(profile.id, { username: event.target.value })
                    }
                    autoComplete="off"
                  />
                  <Input
                    label="密码（可选）"
                    type="password"
                    value={profile.password || ''}
                    onChange={(event) =>
                      updateProfile(profile.id, { password: event.target.value })
                    }
                    autoComplete="off"
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section} aria-label="站点分配">
        <h2 className={styles.sectionTitle}>站点分配</h2>

        {webviewTools.map((tool) => {
          const config = settings.tools[tool.id] ?? { toolId: tool.id, mode: 'system' as const };

          return (
            <article key={tool.id} className={styles.toolCard} aria-label={`${tool.name} 代理设置`}>
              <div className={styles.toolHeader}>
                <h3 className={styles.toolName}>{tool.name}</h3>
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
                      onClick={() => {
                        if (option.value === 'profile') {
                          const firstProfileId = profileList[0]?.id;
                          updateToolConfig(tool.id, {
                            mode: 'profile',
                            profileId: config.profileId ?? firstProfileId,
                          });
                          return;
                        }
                        updateToolConfig(tool.id, { mode: option.value, profileId: undefined });
                      }}
                      aria-pressed={config.mode === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {config.mode === 'profile' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor={`${tool.id}-profile`}>
                    选择代理
                  </label>
                  {profileList.length === 0 ? (
                    <p className={styles.emptyHint}>请先在代理库中添加代理。</p>
                  ) : (
                    <select
                      id={`${tool.id}-profile`}
                      className={styles.select}
                      value={config.profileId || profileList[0]?.id || ''}
                      onChange={(event) =>
                        updateToolConfig(tool.id, { profileId: event.target.value })
                      }
                    >
                      {profileList.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {formatProxyProfile(profile)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <footer className={styles.footer}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {saveMessage && <p className={styles.message}>{saveMessage}</p>}
        <div className={styles.actions}>
          <Button onClick={() => void saveSettings()} disabled={isSaving}>
            {isSaving ? '保存中...' : '立即应用'}
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

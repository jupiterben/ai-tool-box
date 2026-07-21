import { useMemo } from 'react';
import { useProxySettings } from '../../hooks/useProxySettings';
import type { ProxyProtocol } from '../../types/proxy-settings';
import { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Alert } from '../ui/Alert';
import styles from './EnvironmentSettingsPage.module.css';

const PROXY_PROTOCOL_OPTIONS: { value: ProxyProtocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks5', label: 'SOCKS5' },
];

const ProxySettingsPanel: React.FC = () => {
  const proxy = useProxySettings();

  const proxyProfileList = useMemo(
    () => Object.values(proxy.settings.profiles),
    [proxy.settings.profiles]
  );

  if (proxy.isLoading) {
    return <SettingsLoading message="加载代理设置..." />;
  }

  return (
    <>
      <Alert variant="info">
        当前 Preset 共用一个上游代理。若需不同网站走不同出口，请把上游设为本机 Clash 等，并在其中配置域名规则。
      </Alert>

      <div className={styles.toolbar}>
        <Button size="sm" variant="outline" onClick={proxy.addProfile} disabled={proxy.isSaving}>
          添加代理
        </Button>
      </div>

      <section className={styles.section} aria-label="代理库">
        {proxyProfileList.length === 0 ? (
          <p className={styles.emptyHint}>暂无代理，点击「添加代理」创建。</p>
        ) : (
          <div className={styles.profileList}>
            {proxyProfileList.map((profile) => (
              <article key={profile.id} className={styles.profileCard} aria-label={`代理 ${profile.name}`}>
                <div className={styles.profileCardHeader}>
                  <Input
                    label="名称"
                    placeholder="本地 Clash"
                    value={profile.name}
                    onChange={(event) =>
                      proxy.updateProfile(profile.id, { name: event.target.value })
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => proxy.removeProfile(profile.id)}
                    disabled={proxy.isSaving}
                  >
                    删除
                  </Button>
                </div>

                <div className={styles.proxyFields}>
                  <div className={settingsStyles.fieldGroup}>
                    <label className={settingsStyles.label} htmlFor={`${profile.id}-protocol`}>
                      协议
                    </label>
                    <Select
                      id={`${profile.id}-protocol`}
                      value={profile.protocol || 'http'}
                      onChange={(event) =>
                        proxy.updateProfile(profile.id, {
                          protocol: event.target.value as ProxyProtocol,
                        })
                      }
                    >
                      {PROXY_PROTOCOL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Input
                    label="主机"
                    placeholder="127.0.0.1"
                    value={profile.host || ''}
                    onChange={(event) =>
                      proxy.updateProfile(profile.id, { host: event.target.value })
                    }
                  />
                  <Input
                    label="端口"
                    placeholder="7890"
                    value={profile.port || ''}
                    onChange={(event) =>
                      proxy.updateProfile(profile.id, { port: event.target.value })
                    }
                  />
                </div>

                <div className={styles.proxyAuthFields}>
                  <Input
                    label="用户名"
                    placeholder="可选"
                    value={profile.username || ''}
                    onChange={(event) =>
                      proxy.updateProfile(profile.id, { username: event.target.value })
                    }
                    autoComplete="off"
                  />
                  <Input
                    label="密码"
                    type="password"
                    placeholder="可选"
                    value={profile.password || ''}
                    onChange={(event) =>
                      proxy.updateProfile(profile.id, { password: event.target.value })
                    }
                    autoComplete="off"
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className={styles.footerCompact}>
        {proxy.error && <Alert variant="error">{proxy.error}</Alert>}
        {proxy.saveMessage && <Alert variant="success">{proxy.saveMessage}</Alert>}
        <div className={styles.footerActions}>
          <Button size="sm" onClick={() => void proxy.saveSettings()} disabled={proxy.isSaving}>
            {proxy.isSaving ? '保存中...' : '立即应用'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void proxy.loadSettings()}
            disabled={proxy.isSaving}
          >
            重新加载
          </Button>
        </div>
      </div>
    </>
  );
};

export default ProxySettingsPanel;

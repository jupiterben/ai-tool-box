import { useMemo, useState } from 'react';
import { useGeolocationSettings } from '../../hooks/useGeolocationSettings';
import { useProxySettings } from '../../hooks/useProxySettings';
import type { ProxyProtocol } from '../../types/proxy-settings';
import SettingsPageLayout, { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SegmentControl } from '../ui/SegmentControl';
import { Alert } from '../ui/Alert';
import styles from './EnvironmentSettingsPage.module.css';

type EnvTab = 'proxy' | 'geo';

const ENV_TABS: { value: EnvTab; label: string }[] = [
  { value: 'proxy', label: '网络代理' },
  { value: 'geo', label: 'GPS 定位' },
];

const PROXY_PROTOCOL_OPTIONS: { value: ProxyProtocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks5', label: 'SOCKS5' },
];

function parseCoordinate(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const EnvironmentSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EnvTab>('proxy');
  const proxy = useProxySettings();
  const geo = useGeolocationSettings();

  const proxyProfileList = useMemo(
    () => Object.values(proxy.settings.profiles),
    [proxy.settings.profiles]
  );

  const geoProfileList = useMemo(
    () => Object.values(geo.settings.profiles),
    [geo.settings.profiles]
  );

  const isLoading = proxy.isLoading || geo.isLoading;
  const isSaving = proxy.isSaving || geo.isSaving;
  const error = proxy.error || geo.error;
  const saveMessage = [proxy.saveMessage, geo.saveMessage].filter(Boolean).join(' ');

  if (isLoading) {
    return <SettingsLoading message="加载环境设置..." />;
  }

  return (
    <SettingsPageLayout
      title="网络与定位"
      description="定义代理与 GPS 预设，在「网站管理」中为各站分配。"
      ariaLabel="网络与定位设置"
      className={styles.pageCompact}
      footer={
        <div className={styles.footerCompact}>
          {error && <Alert variant="error">{error}</Alert>}
          {saveMessage && <Alert variant="success">{saveMessage}</Alert>}
          <div className={styles.footerActions}>
            <Button
              size="sm"
              onClick={() => {
                void proxy.saveSettings();
                void geo.saveSettings();
              }}
              disabled={isSaving}
            >
              {isSaving ? '保存中...' : '立即应用'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void proxy.loadSettings();
                void geo.loadSettings();
              }}
              disabled={isSaving}
            >
              重新加载
            </Button>
          </div>
        </div>
      }
    >
      <div className={styles.toolbar}>
        <SegmentControl
          options={ENV_TABS}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="环境设置分类"
        />
        {activeTab === 'proxy' ? (
          <Button size="sm" variant="outline" onClick={proxy.addProfile} disabled={isSaving}>
            添加代理
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={geo.addProfile} disabled={isSaving}>
            添加位置
          </Button>
        )}
      </div>

      {activeTab === 'proxy' ? (
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
                      disabled={isSaving}
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
      ) : (
        <section className={styles.section} aria-label="位置库">
          {geoProfileList.length === 0 ? (
            <p className={styles.emptyHint}>暂无位置，点击「添加位置」创建。</p>
          ) : (
            <div className={styles.profileList}>
              {geoProfileList.map((profile) => (
                <article key={profile.id} className={styles.profileCard} aria-label={`位置 ${profile.name}`}>
                  <div className={styles.profileCardHeader}>
                    <Input
                      label="名称"
                      placeholder="北京"
                      value={profile.name}
                      onChange={(event) =>
                        geo.updateProfile(profile.id, { name: event.target.value })
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => geo.removeProfile(profile.id)}
                      disabled={isSaving}
                    >
                      删除
                    </Button>
                  </div>

                  <div className={styles.coordFields}>
                    <Input
                      label="纬度"
                      placeholder="39.9042"
                      value={String(profile.latitude)}
                      onChange={(event) =>
                        geo.updateProfile(profile.id, {
                          latitude: parseCoordinate(event.target.value, profile.latitude),
                        })
                      }
                    />
                    <Input
                      label="经度"
                      placeholder="116.4074"
                      value={String(profile.longitude)}
                      onChange={(event) =>
                        geo.updateProfile(profile.id, {
                          longitude: parseCoordinate(event.target.value, profile.longitude),
                        })
                      }
                    />
                    <Input
                      label="精度(m)"
                      placeholder="100"
                      value={String(profile.accuracy)}
                      onChange={(event) =>
                        geo.updateProfile(profile.id, {
                          accuracy: parseCoordinate(event.target.value, profile.accuracy),
                        })
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </SettingsPageLayout>
  );
};

export default EnvironmentSettingsPage;

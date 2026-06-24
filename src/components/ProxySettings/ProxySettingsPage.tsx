import { useMemo } from 'react';
import { DEFAULT_TOOLS, groupToolsByRegion } from '../../config/tools';
import { useProxySettings } from '../../hooks/useProxySettings';
import type { ProxyMode, ProxyProtocol } from '../../types/proxy-settings';
import SettingsPageLayout, { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SegmentControl } from '../ui/SegmentControl';
import { Alert } from '../ui/Alert';
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

  const toolGroups = useMemo(
    () => groupToolsByRegion(DEFAULT_TOOLS.filter((tool) => Boolean(tool.url))),
    []
  );

  const profileList = useMemo(
    () => Object.values(settings.profiles),
    [settings.profiles]
  );

  if (isLoading) {
    return <SettingsLoading message="加载代理设置..." />;
  }

  return (
    <SettingsPageLayout
      title="网络代理设置"
      description="先在代理库中定义代理，再为各网站选择网络环境。修改后会自动保存并应用到 Webview。"
      ariaLabel="网络代理设置"
      footer={
        <>
          {error && <Alert variant="error">{error}</Alert>}
          {saveMessage && <Alert variant="success">{saveMessage}</Alert>}
          <div className={settingsStyles.actions}>
            <Button onClick={() => void saveSettings()} disabled={isSaving}>
              {isSaving ? '保存中...' : '立即应用'}
            </Button>
            <Button variant="outline" onClick={() => void loadSettings()} disabled={isSaving}>
              重新加载
            </Button>
          </div>
        </>
      }
    >
      <section className={settingsStyles.section} aria-label="代理库">
        <div className={settingsStyles.sectionHeader}>
          <h2 className={settingsStyles.sectionTitle}>代理库</h2>
          <Button variant="outline" onClick={addProfile} disabled={isSaving}>
            添加代理
          </Button>
        </div>

        {profileList.length === 0 ? (
          <p className={settingsStyles.emptyHint}>暂无代理，点击「添加代理」创建第一条。</p>
        ) : (
          <div className={settingsStyles.profileList}>
            {profileList.map((profile) => (
              <article key={profile.id} className={settingsStyles.profileCard} aria-label={`代理 ${profile.name}`}>
                <div className={settingsStyles.profileCardHeader}>
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
                    onClick={() => removeProfile(profile.id)}
                    disabled={isSaving}
                  >
                    删除
                  </Button>
                </div>

                <div className={styles.manualFields}>
                  <div className={settingsStyles.fieldGroup}>
                    <label className={settingsStyles.label} htmlFor={`${profile.id}-protocol`}>
                      协议
                    </label>
                    <Select
                      id={`${profile.id}-protocol`}
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
                    </Select>
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

      <section className={settingsStyles.section} aria-label="站点分配">
        <h2 className={settingsStyles.sectionTitle}>站点分配</h2>

        {toolGroups.map((group) => (
          <div key={group.region} className={settingsStyles.siteGroup} aria-label={group.label}>
            <div className={settingsStyles.siteGroupHeader}>
              <span className={settingsStyles.siteGroupLabel}>{group.label}</span>
              <span className={settingsStyles.siteGroupColHint} aria-hidden="true">网络模式</span>
            </div>
            <ul className={settingsStyles.siteList}>
              {group.tools.map((tool) => {
                const config = settings.tools[tool.id] ?? { toolId: tool.id, mode: 'system' as const };

                return (
                  <li key={tool.id} className={settingsStyles.siteRow}>
                    <span className={settingsStyles.siteName} title={tool.url}>
                      {tool.name}
                    </span>
                    <div className={settingsStyles.siteControls}>
                      <SegmentControl
                        options={MODE_OPTIONS}
                        value={config.mode}
                        onChange={(mode) => {
                          if (mode === 'profile') {
                            const firstProfileId = profileList[0]?.id;
                            updateToolConfig(tool.id, {
                              mode: 'profile',
                              profileId: config.profileId ?? firstProfileId,
                            });
                            return;
                          }
                          updateToolConfig(tool.id, { mode, profileId: undefined });
                        }}
                        ariaLabel={`${tool.name} 网络模式`}
                      />
                      {config.mode === 'profile' && (
                        profileList.length === 0 ? (
                          <span className={settingsStyles.siteProfileHint}>请先添加代理</span>
                        ) : (
                          <Select
                            compact
                            id={`${tool.id}-profile`}
                            value={config.profileId || profileList[0]?.id || ''}
                            onChange={(event) =>
                              updateToolConfig(tool.id, { profileId: event.target.value })
                            }
                            aria-label={`${tool.name} 选择代理`}
                          >
                            {profileList.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name || '未命名'}
                              </option>
                            ))}
                          </Select>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </SettingsPageLayout>
  );
};

export default ProxySettingsPage;

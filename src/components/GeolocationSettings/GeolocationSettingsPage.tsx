import { useMemo } from 'react';
import { DEFAULT_TOOLS, groupToolsByRegion } from '../../config/tools';
import { useGeolocationSettings } from '../../hooks/useGeolocationSettings';
import type { GeolocationMode } from '../../types/geolocation-settings';
import SettingsPageLayout, { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SegmentControl } from '../ui/SegmentControl';
import { Alert } from '../ui/Alert';
import styles from './GeolocationSettingsPage.module.css';

const MODE_OPTIONS: { value: GeolocationMode; label: string }[] = [
  { value: 'system', label: '系统定位' },
  { value: 'profile', label: '虚拟定位' },
];

function parseCoordinate(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const GeolocationSettingsPage: React.FC = () => {
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
  } = useGeolocationSettings();

  const toolGroups = useMemo(
    () => groupToolsByRegion(DEFAULT_TOOLS.filter((tool) => Boolean(tool.url))),
    []
  );

  const profileList = useMemo(
    () => Object.values(settings.profiles),
    [settings.profiles]
  );

  if (isLoading) {
    return <SettingsLoading message="加载 GPS 设置..." />;
  }

  return (
    <SettingsPageLayout
      title="GPS 虚拟定位"
      description="在位置库中定义坐标，再为各网站分配虚拟 GPS。修改后会自动保存并应用到 Webview。"
      ariaLabel="GPS 虚拟定位设置"
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
      <section className={settingsStyles.section} aria-label="位置库">
        <div className={settingsStyles.sectionHeader}>
          <h2 className={settingsStyles.sectionTitle}>位置库</h2>
          <Button variant="outline" onClick={addProfile} disabled={isSaving}>
            添加位置
          </Button>
        </div>

        {profileList.length === 0 ? (
          <p className={settingsStyles.emptyHint}>暂无位置，点击「添加位置」创建第一条。</p>
        ) : (
          <div className={settingsStyles.profileList}>
            {profileList.map((profile) => (
              <article key={profile.id} className={settingsStyles.profileCard} aria-label={`位置 ${profile.name}`}>
                <div className={settingsStyles.profileCardHeader}>
                  <Input
                    label="名称"
                    placeholder="例如：北京"
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

                <div className={styles.coordFields}>
                  <Input
                    label="纬度"
                    placeholder="39.9042"
                    value={String(profile.latitude)}
                    onChange={(event) =>
                      updateProfile(profile.id, {
                        latitude: parseCoordinate(event.target.value, profile.latitude),
                      })
                    }
                  />
                  <Input
                    label="经度"
                    placeholder="116.4074"
                    value={String(profile.longitude)}
                    onChange={(event) =>
                      updateProfile(profile.id, {
                        longitude: parseCoordinate(event.target.value, profile.longitude),
                      })
                    }
                  />
                  <Input
                    label="精度（米）"
                    placeholder="100"
                    value={String(profile.accuracy)}
                    onChange={(event) =>
                      updateProfile(profile.id, {
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

      <section className={settingsStyles.section} aria-label="站点分配">
        <h2 className={settingsStyles.sectionTitle}>站点分配</h2>

        {toolGroups.map((group) => (
          <div key={group.region} className={settingsStyles.siteGroup} aria-label={group.label}>
            <div className={settingsStyles.siteGroupHeader}>
              <span className={settingsStyles.siteGroupLabel}>{group.label}</span>
              <span className={settingsStyles.siteGroupColHint} aria-hidden="true">定位模式</span>
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
                        ariaLabel={`${tool.name} 定位模式`}
                      />
                      {config.mode === 'profile' && (
                        profileList.length === 0 ? (
                          <span className={settingsStyles.siteProfileHint}>请先添加位置</span>
                        ) : (
                          <Select
                            compact
                            id={`${tool.id}-geo-profile`}
                            value={config.profileId || profileList[0]?.id || ''}
                            onChange={(event) =>
                              updateToolConfig(tool.id, { profileId: event.target.value })
                            }
                            aria-label={`${tool.name} 选择虚拟位置`}
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

export default GeolocationSettingsPage;

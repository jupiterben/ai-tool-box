import { useMemo } from 'react';
import { DEFAULT_TOOLS, groupToolsByRegion } from '../../config/tools';
import { useGeolocationSettings } from '../../hooks/useGeolocationSettings';
import type { GeolocationMode } from '../../types/geolocation-settings';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
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
    return <div className={styles.loading}>加载 GPS 设置...</div>;
  }

  return (
    <div className={styles.geolocationSettings} role="main" aria-label="GPS 虚拟定位设置">
      <header className={styles.header}>
        <h1 className={styles.title}>GPS 虚拟定位</h1>
        <p className={styles.description}>
          在位置库中定义坐标，再为各网站分配虚拟 GPS。修改后会自动保存并应用到 Webview。
        </p>
      </header>

      <section className={styles.section} aria-label="位置库">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>位置库</h2>
          <Button variant="outline" onClick={addProfile} disabled={isSaving}>
            添加位置
          </Button>
        </div>

        {profileList.length === 0 ? (
          <p className={styles.emptyHint}>暂无位置，点击「添加位置」创建第一条。</p>
        ) : (
          <div className={styles.profileList}>
            {profileList.map((profile) => (
              <article key={profile.id} className={styles.profileCard} aria-label={`位置 ${profile.name}`}>
                <div className={styles.profileCardHeader}>
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
                    className={styles.deleteButton}
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

      <section className={styles.section} aria-label="站点分配">
        <h2 className={styles.sectionTitle}>站点分配</h2>

        {toolGroups.map((group) => (
          <div key={group.region} className={styles.siteGroup} aria-label={group.label}>
            <div className={styles.siteGroupHeader}>
              <span className={styles.siteGroupLabel}>{group.label}</span>
              <span className={styles.siteGroupColHint} aria-hidden="true">定位模式</span>
            </div>
            <ul className={styles.siteList}>
              {group.tools.map((tool) => {
                const config = settings.tools[tool.id] ?? { toolId: tool.id, mode: 'system' as const };

                return (
                  <li key={tool.id} className={styles.siteRow}>
                    <span className={styles.siteName} title={tool.url}>
                      {tool.name}
                    </span>
                    <div className={styles.siteControls}>
                      <div
                        className={styles.modeSegment}
                        role="group"
                        aria-label={`${tool.name} 定位模式`}
                      >
                        {MODE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.modeSegmentBtn} ${
                              config.mode === option.value ? styles.modeSegmentBtnActive : ''
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
                      {config.mode === 'profile' && (
                        profileList.length === 0 ? (
                          <span className={styles.siteProfileHint}>请先添加位置</span>
                        ) : (
                          <select
                            id={`${tool.id}-geo-profile`}
                            className={styles.profileSelect}
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
                          </select>
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

export default GeolocationSettingsPage;

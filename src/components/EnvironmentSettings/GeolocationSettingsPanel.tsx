import { useMemo } from 'react';
import { useGeolocationSettings } from '../../hooks/useGeolocationSettings';
import { SettingsLoading } from '../settings/SettingsPageLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import styles from './EnvironmentSettingsPage.module.css';

function parseCoordinate(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const GeolocationSettingsPanel: React.FC = () => {
  const geo = useGeolocationSettings();

  const geoProfileList = useMemo(
    () => Object.values(geo.settings.profiles),
    [geo.settings.profiles]
  );

  if (geo.isLoading) {
    return <SettingsLoading message="加载定位设置..." />;
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Button size="sm" variant="outline" onClick={geo.addProfile} disabled={geo.isSaving}>
          添加位置
        </Button>
      </div>

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
                    disabled={geo.isSaving}
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

      <div className={styles.footerCompact}>
        {geo.error && <Alert variant="error">{geo.error}</Alert>}
        {geo.saveMessage && <Alert variant="success">{geo.saveMessage}</Alert>}
        <div className={styles.footerActions}>
          <Button size="sm" onClick={() => void geo.saveSettings()} disabled={geo.isSaving}>
            {geo.isSaving ? '保存中...' : '立即应用'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void geo.loadSettings()}
            disabled={geo.isSaving}
          >
            重新加载
          </Button>
        </div>
      </div>
    </>
  );
};

export default GeolocationSettingsPanel;

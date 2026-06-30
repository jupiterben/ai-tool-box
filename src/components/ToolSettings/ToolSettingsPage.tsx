import { useMemo, useState } from 'react';
import {
  TOOL_CATEGORY_LABELS,
  getToolsByCategory,
  groupToolsByRegion,
} from '../../config/tools';
import { useGeolocationSettings } from '../../hooks/useGeolocationSettings';
import { useProxySettings } from '../../hooks/useProxySettings';
import { useSessionSettings } from '../../hooks/useSessionSettings';
import { useToolSettings } from '../../hooks/useToolSettings';
import type { ToolCategory } from '../../types/ai-tool';
import type { GeolocationMode } from '../../types/geolocation-settings';
import type { ProxyMode } from '../../types/proxy-settings';
import SettingsPageLayout, { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Toggle } from '../ui/Toggle';
import { Select } from '../ui/Select';
import { SegmentControl } from '../ui/SegmentControl';
import { Alert } from '../ui/Alert';
import styles from './ToolSettingsPage.module.css';

const CATEGORY_TABS: { value: ToolCategory; label: string }[] = [
  { value: 'chat', label: TOOL_CATEGORY_LABELS.chat },
  { value: 'image', label: TOOL_CATEGORY_LABELS.image },
];

const PROXY_MODE_OPTIONS: { value: ProxyMode; label: string }[] = [
  { value: 'direct', label: '直连' },
  { value: 'system', label: '系统代理' },
  { value: 'profile', label: '使用代理' },
];

const GEO_MODE_OPTIONS: { value: GeolocationMode; label: string }[] = [
  { value: 'system', label: '系统定位' },
  { value: 'profile', label: '虚拟定位' },
];

const ToolSettingsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('chat');
  const { isLoading: isToolLoading, saveMessage, setToolEnabled, isToolEnabled } =
    useToolSettings();
  const proxy = useProxySettings();
  const geo = useGeolocationSettings();
  const session = useSessionSettings();

  const proxyProfileList = useMemo(
    () => Object.values(proxy.settings.profiles),
    [proxy.settings.profiles]
  );

  const geoProfileList = useMemo(
    () => Object.values(geo.settings.profiles),
    [geo.settings.profiles]
  );

  const categoryTools = useMemo(
    () => getToolsByCategory(activeCategory).filter((tool) => Boolean(tool.url)),
    [activeCategory]
  );

  const toolGroups = useMemo(() => groupToolsByRegion(categoryTools), [categoryTools]);

  const enabledCount = useMemo(
    () => categoryTools.filter((tool) => isToolEnabled(tool.id)).length,
    [categoryTools, isToolEnabled]
  );

  const isLoading = isToolLoading || proxy.isLoading || geo.isLoading || session.isLoading;

  const alerts = useMemo(() => {
    const items: { id: string; message: string }[] = [];
    if (saveMessage) items.push({ id: 'tool', message: saveMessage });
    if (proxy.saveMessage) items.push({ id: 'proxy', message: proxy.saveMessage });
    if (geo.saveMessage) items.push({ id: 'geo', message: geo.saveMessage });
    if (session.saveMessage) items.push({ id: 'session', message: session.saveMessage });
    return items;
  }, [saveMessage, proxy.saveMessage, geo.saveMessage, session.saveMessage]);

  const errors = useMemo(() => {
    const items: { id: string; message: string }[] = [];
    if (proxy.error) items.push({ id: 'proxy', message: proxy.error });
    if (geo.error) items.push({ id: 'geo', message: geo.error });
    if (session.error) items.push({ id: 'session', message: session.error });
    return items;
  }, [proxy.error, geo.error, session.error]);

  if (isLoading) {
    return <SettingsLoading message="加载网站设置..." />;
  }

  return (
    <SettingsPageLayout
      title="网站管理"
      description="按对话与生图分类管理各网站的启用状态、无痕模式、网络代理与 GPS 定位。代理与位置预设请在「网络与定位」页面定义。"
      ariaLabel="网站管理"
      className={styles.pageWide}
    >
      <div className={styles.categoryTabs}>
        <SegmentControl
          options={CATEGORY_TABS}
          value={activeCategory}
          onChange={setActiveCategory}
          ariaLabel="网站分类"
        />
      </div>

      <section className={settingsStyles.section} aria-label={`${TOOL_CATEGORY_LABELS[activeCategory]}网站`}>
        {toolGroups.map((group) => (
          <div key={group.region} className={settingsStyles.siteGroup} aria-label={group.label}>
            <div className={styles.siteGroupTitleBar}>
              <span className={settingsStyles.siteGroupLabel}>{group.label}</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.siteTable}>
                <colgroup>
                  <col />
                  <col className={styles.colToggle} />
                  <col className={styles.colToggle} />
                  <col className={styles.colEnv} />
                  <col className={styles.colEnv} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">网站</th>
                    <th scope="col">启用</th>
                    <th scope="col">无痕</th>
                    <th scope="col">网络</th>
                    <th scope="col">定位</th>
                  </tr>
                </thead>
                <tbody>
                  {group.tools.map((tool) => {
                    const enabled = isToolEnabled(tool.id);
                    const isLastEnabled = enabled && enabledCount <= 1;
                    const proxyConfig = proxy.settings.tools[tool.id] ?? {
                      toolId: tool.id,
                      mode: 'system' as const,
                    };
                    const geoConfig = geo.settings.tools[tool.id] ?? {
                      toolId: tool.id,
                      mode: 'system' as const,
                    };
                    const incognito = session.isToolIncognito(tool.id);

                    return (
                      <tr key={tool.id}>
                        <td className={styles.siteCell}>
                          <div className={settingsStyles.siteInfo}>
                            <span className={settingsStyles.siteName}>{tool.name}</span>
                            <span className={settingsStyles.siteUrl} title={tool.url}>
                              {tool.url}
                            </span>
                          </div>
                        </td>

                        <td className={styles.toggleCell}>
                          <Toggle
                            checked={enabled}
                            disabled={isLastEnabled}
                            onChange={(event) => setToolEnabled(tool.id, event.target.checked)}
                            label={`${tool.name} ${enabled ? '已启用' : '已关闭'}`}
                            title={
                              isLastEnabled
                                ? '至少保留一个启用的网站'
                                : enabled
                                  ? '点击关闭'
                                  : '点击启用'
                            }
                          />
                        </td>

                        <td className={styles.toggleCell}>
                          <Toggle
                            checked={incognito}
                            onChange={(event) =>
                              session.setToolIncognito(tool.id, event.target.checked)
                            }
                            label={`${tool.name} ${incognito ? '无痕模式' : '普通模式'}`}
                        title={
                          incognito
                            ? '无痕模式：临时会话，切换/关闭后清除数据'
                            : '开启无痕：独立临时会话，不写入磁盘（类似 Chrome 无痕窗口）'
                        }
                          />
                        </td>

                        <td className={styles.envCell}>
                          <div className={styles.envControlGroup}>
                            <SegmentControl
                              options={PROXY_MODE_OPTIONS}
                              value={proxyConfig.mode}
                              onChange={(mode) => {
                                if (mode === 'profile') {
                                  const firstProfileId = proxyProfileList[0]?.id;
                                  proxy.updateToolConfig(tool.id, {
                                    mode: 'profile',
                                    profileId: proxyConfig.profileId ?? firstProfileId,
                                  });
                                  return;
                                }
                                proxy.updateToolConfig(tool.id, { mode, profileId: undefined });
                              }}
                              ariaLabel={`${tool.name} 网络模式`}
                            />
                            {proxyConfig.mode === 'profile' &&
                              (proxyProfileList.length === 0 ? (
                                <span className={settingsStyles.siteProfileHint}>请先添加代理</span>
                              ) : (
                                <Select
                                  compact
                                  id={`${tool.id}-proxy-profile`}
                                  value={proxyConfig.profileId || proxyProfileList[0]?.id || ''}
                                  onChange={(event) =>
                                    proxy.updateToolConfig(tool.id, {
                                      profileId: event.target.value,
                                    })
                                  }
                                  aria-label={`${tool.name} 选择代理`}
                                >
                                  {proxyProfileList.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                      {profile.name || '未命名'}
                                    </option>
                                  ))}
                                </Select>
                              ))}
                          </div>
                        </td>

                        <td className={styles.envCell}>
                          <div className={styles.envControlGroup}>
                            <SegmentControl
                              options={GEO_MODE_OPTIONS}
                              value={geoConfig.mode}
                              onChange={(mode) => {
                                if (mode === 'profile') {
                                  const firstProfileId = geoProfileList[0]?.id;
                                  geo.updateToolConfig(tool.id, {
                                    mode: 'profile',
                                    profileId: geoConfig.profileId ?? firstProfileId,
                                  });
                                  return;
                                }
                                geo.updateToolConfig(tool.id, { mode, profileId: undefined });
                              }}
                              ariaLabel={`${tool.name} 定位模式`}
                            />
                            {geoConfig.mode === 'profile' &&
                              (geoProfileList.length === 0 ? (
                                <span className={settingsStyles.siteProfileHint}>请先添加位置</span>
                              ) : (
                                <Select
                                  compact
                                  id={`${tool.id}-geo-profile`}
                                  value={geoConfig.profileId || geoProfileList[0]?.id || ''}
                                  onChange={(event) =>
                                    geo.updateToolConfig(tool.id, {
                                      profileId: event.target.value,
                                    })
                                  }
                                  aria-label={`${tool.name} 选择虚拟位置`}
                                >
                                  {geoProfileList.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                      {profile.name || '未命名'}
                                    </option>
                                  ))}
                                </Select>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {(errors.length > 0 || alerts.length > 0) && (
        <div className={styles.footerAlerts}>
          {errors.map((item) => (
            <Alert key={item.id} variant="error">
              {item.message}
            </Alert>
          ))}
          {alerts.map((item) => (
            <Alert key={item.id} variant="success">
              {item.message}
            </Alert>
          ))}
        </div>
      )}
    </SettingsPageLayout>
  );
};

export default ToolSettingsPage;

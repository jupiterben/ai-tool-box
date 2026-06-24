import { useMemo } from 'react';
import { DEFAULT_TOOLS, groupToolsByRegion } from '../../config/tools';
import { useToolSettings } from '../../hooks/useToolSettings';
import SettingsPageLayout, { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Toggle } from '../ui/Toggle';
import { Alert } from '../ui/Alert';

const ToolSettingsPage: React.FC = () => {
  const { settings, isLoading, saveMessage, setToolEnabled, isToolEnabled } = useToolSettings();

  const toolGroups = useMemo(
    () => groupToolsByRegion(DEFAULT_TOOLS.filter((tool) => Boolean(tool.url))),
    []
  );

  const enabledCount = DEFAULT_TOOLS.length - settings.disabledToolIds.length;

  if (isLoading) {
    return <SettingsLoading message="加载网站设置..." />;
  }

  return (
    <SettingsPageLayout
      title="网站管理"
      description="控制各 AI 网站是否在多 Webview 工具中显示。关闭后不会加载对应页面，但仍可在代理与 GPS 设置中预先配置。"
      ariaLabel="网站管理"
    >
      <section className={settingsStyles.section} aria-label="网站开关">
        <h2 className={settingsStyles.sectionTitle}>启用网站</h2>

        {toolGroups.map((group) => (
          <div key={group.region} className={settingsStyles.siteGroup} aria-label={group.label}>
            <div className={settingsStyles.siteGroupHeader}>
              <span className={settingsStyles.siteGroupLabel}>{group.label}</span>
              <span className={settingsStyles.siteGroupColHint}>启用</span>
            </div>
            <ul className={settingsStyles.siteList}>
              {group.tools.map((tool) => {
                const enabled = isToolEnabled(tool.id);
                const isLastEnabled = enabled && enabledCount <= 1;

                return (
                  <li key={tool.id} className={settingsStyles.siteRow}>
                    <div className={settingsStyles.siteInfo}>
                      <span className={settingsStyles.siteName}>{tool.name}</span>
                      <span className={settingsStyles.siteUrl} title={tool.url}>
                        {tool.url}
                      </span>
                    </div>
                    <Toggle
                      checked={enabled}
                      disabled={isLastEnabled}
                      onChange={(event) => setToolEnabled(tool.id, event.target.checked)}
                      label={`${tool.name} ${enabled ? '已启用' : '已关闭'}`}
                      title={isLastEnabled ? '至少保留一个启用的网站' : enabled ? '点击关闭' : '点击启用'}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {saveMessage && <Alert variant="success">{saveMessage}</Alert>}
    </SettingsPageLayout>
  );
};

export default ToolSettingsPage;

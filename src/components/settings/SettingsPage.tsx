import { useEffect, useState } from 'react';
import LlmSettingsPanel from '../LlmSettings/LlmSettingsPanel';
import ToolSettingsPanel from '../ToolSettings/ToolSettingsPanel';
import ProxySettingsPanel from '../EnvironmentSettings/ProxySettingsPanel';
import GeolocationSettingsPanel from '../EnvironmentSettings/GeolocationSettingsPanel';
import ApiSettingsPanel from '../ApiSettings/ApiSettingsPanel';
import SettingsPageLayout from './SettingsPageLayout';
import { Icon, type IconName } from '../ui/Icon';
import styles from './SettingsPage.module.css';
import AgentCliSettingsPanel from '../AgentCliSettings/AgentCliSettingsPanel';
import PresetSettingsPanel from '../PresetSettings/PresetSettingsPanel';

type SettingsTab =
  | 'presets'
  | 'agents'
  | 'llm'
  | 'api'
  | 'chat-tools'
  | 'image-tools'
  | 'video-tools'
  | 'proxy'
  | 'geo';

interface SettingsNavItem {
  value: SettingsTab;
  label: string;
  icon: IconName;
}

const SETTINGS_GROUPS: { label: string; items: SettingsNavItem[] }[] = [
  {
    label: '工作区',
    items: [{ value: 'presets', label: 'Preset', icon: 'Layers' }],
  },
  {
    label: '智能能力',
    items: [
      { value: 'agents', label: 'Agent CLI', icon: 'TerminalSquare' },
      { value: 'llm', label: 'LLM 汇总', icon: 'Sparkles' },
      { value: 'api', label: 'API 服务', icon: 'ServerCog' },
    ],
  },
  {
    label: '网站工具',
    items: [
      { value: 'chat-tools', label: '对话网站', icon: 'MessagesSquare' },
      { value: 'image-tools', label: '生图网站', icon: 'Image' },
      { value: 'video-tools', label: '生视频网站', icon: 'Clapperboard' },
    ],
  },
  {
    label: '运行环境',
    items: [
      { value: 'proxy', label: '网络代理', icon: 'Network' },
      { value: 'geo', label: 'GPS 定位', icon: 'MapPin' },
    ],
  },
];

const TAB_DESCRIPTIONS: Record<SettingsTab, string> = {
  presets: '管理命名工作区：新建、重命名、删除；切换时新开窗口并隔离登录态。',
  agents: '统一安装、升级和配置 Cursor、Claude、Gemini 等本机 Agent CLI。',
  llm: '配置 LLM API，收集各平台回复时自动调用 AI 生成结构化 Markdown 汇总。',
  api: '控制本机生图 API 服务的启用状态、监听端口和实际访问地址。',
  'chat-tools': '管理对话类网站的启用状态。',
  'image-tools': '管理生图类网站的启用状态。',
  'video-tools': '管理生视频类网站的启用状态。',
  proxy: '配置当前 Preset 的上游代理。同一 Preset 共用一个上游；按站分流请在本机代理规则中配置。',
  geo: '配置当前 Preset 的 GPS 定位。',
};

function readInitialTab(): SettingsTab {
  const fromStorage = sessionStorage.getItem('ai-tool-box-settings-tab');
  if (fromStorage === 'presets') {
    sessionStorage.removeItem('ai-tool-box-settings-tab');
    return 'presets';
  }
  return 'presets';
}

const SettingsPage: React.FC = () => {
  const initial = readInitialTab();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initial);
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTab>>(() => new Set([initial]));

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  return (
    <SettingsPageLayout
      title="设置"
      description={TAB_DESCRIPTIONS[activeTab]}
      ariaLabel="应用设置"
    >
      <div className={styles.settingsShell}>
        <nav className={styles.navigation} aria-label="设置分类">
          {SETTINGS_GROUPS.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <span className={styles.navGroupLabel}>{group.label}</span>
              <div className={styles.navItems}>
                {group.items.map((item) => {
                  const isActive = activeTab === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                      onClick={() => setActiveTab(item.value)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon name={item.icon} size={18} strokeWidth={1.8} />
                      <span>{item.label}</span>
                      {isActive && (
                        <Icon name="ChevronRight" size={15} className={styles.navChevron} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <section className={styles.content} aria-live="polite">
          {visitedTabs.has('presets') && (
            <div className={activeTab === 'presets' ? undefined : styles.panelHidden}>
              <PresetSettingsPanel />
            </div>
          )}
          {visitedTabs.has('agents') && (
            <div className={activeTab === 'agents' ? undefined : styles.panelHidden}>
              <AgentCliSettingsPanel />
            </div>
          )}
          {visitedTabs.has('llm') && (
            <div className={activeTab === 'llm' ? undefined : styles.panelHidden}>
              <LlmSettingsPanel />
            </div>
          )}
          {visitedTabs.has('api') && (
            <div className={activeTab === 'api' ? undefined : styles.panelHidden}>
              <ApiSettingsPanel />
            </div>
          )}
          {visitedTabs.has('chat-tools') && (
            <div className={activeTab === 'chat-tools' ? undefined : styles.panelHidden}>
              <ToolSettingsPanel category="chat" />
            </div>
          )}
          {visitedTabs.has('image-tools') && (
            <div className={activeTab === 'image-tools' ? undefined : styles.panelHidden}>
              <ToolSettingsPanel category="image" />
            </div>
          )}
          {visitedTabs.has('video-tools') && (
            <div className={activeTab === 'video-tools' ? undefined : styles.panelHidden}>
              <ToolSettingsPanel category="video" />
            </div>
          )}
          {visitedTabs.has('proxy') && (
            <div className={activeTab === 'proxy' ? undefined : styles.panelHidden}>
              <ProxySettingsPanel />
            </div>
          )}
          {visitedTabs.has('geo') && (
            <div className={activeTab === 'geo' ? undefined : styles.panelHidden}>
              <GeolocationSettingsPanel />
            </div>
          )}
        </section>
      </div>
    </SettingsPageLayout>
  );
};

export default SettingsPage;

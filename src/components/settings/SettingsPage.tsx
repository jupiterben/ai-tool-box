import { useEffect, useState } from 'react';
import LlmSettingsPanel from '../LlmSettings/LlmSettingsPanel';
import ToolSettingsPanel from '../ToolSettings/ToolSettingsPanel';
import ProxySettingsPanel from '../EnvironmentSettings/ProxySettingsPanel';
import GeolocationSettingsPanel from '../EnvironmentSettings/GeolocationSettingsPanel';
import SettingsPageLayout from './SettingsPageLayout';
import { SegmentControl } from '../ui/SegmentControl';
import styles from './SettingsPage.module.css';

type SettingsTab = 'llm' | 'chat-tools' | 'image-tools' | 'proxy' | 'geo';

const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: 'llm', label: 'LLM 汇总' },
  { value: 'chat-tools', label: '对话网站' },
  { value: 'image-tools', label: '生图网站' },
  { value: 'proxy', label: '网络代理' },
  { value: 'geo', label: 'GPS 定位' },
];

const TAB_DESCRIPTIONS: Record<SettingsTab, string> = {
  llm: '配置 LLM API，收集各平台回复时自动调用 AI 生成结构化 Markdown 汇总。',
  'chat-tools': '管理对话类网站的启用状态、网络代理与 GPS 定位。',
  'image-tools': '管理生图类网站的启用状态、网络代理与 GPS 定位。',
  proxy: '定义代理预设，在「对话网站」与「生图网站」中为各站分配。',
  geo: '定义 GPS 位置预设，在「对话网站」与「生图网站」中为各站分配。',
};

const WIDE_TABS: SettingsTab[] = ['chat-tools', 'image-tools'];
const COMPACT_TABS: SettingsTab[] = ['proxy', 'geo'];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTab>>(() => new Set(['llm']));

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const pageClassName = WIDE_TABS.includes(activeTab)
    ? styles.pageWide
    : COMPACT_TABS.includes(activeTab)
      ? styles.pageCompact
      : '';

  return (
    <SettingsPageLayout
      title="设置"
      description={TAB_DESCRIPTIONS[activeTab]}
      ariaLabel="应用设置"
      className={pageClassName}
    >
      <div className={styles.tabs}>
        <SegmentControl
          options={SETTINGS_TABS}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="设置分类"
        />
      </div>

      <div>
        {visitedTabs.has('llm') && (
          <div className={activeTab === 'llm' ? undefined : styles.panelHidden}>
            <LlmSettingsPanel />
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
      </div>
    </SettingsPageLayout>
  );
};

export default SettingsPage;

import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import SettingsPageLayout from '../settings/SettingsPageLayout';
import type { AgentCliConfig, AgentCliId, AgentCliInfo } from '../../types/agent-cli';
import AgentCliCard from './AgentCliCard';
import styles from './AgentCliPage.module.css';

const AgentCliPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentCliInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await window.electronAPI?.listAgentClis();
    if (result?.success && result.agents) {
      setAgents(result.agents);
    } else {
      setError(result?.error || '请在桌面应用中管理 Agent CLI');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAgentsChange = (next: AgentCliInfo[]) => {
    setAgents(next);
  };

  const handleAgentConfigSaved = (id: AgentCliId, config: AgentCliConfig) => {
    setAgents((current) =>
      current.map((item) => (item.id === id ? { ...item, config } : item)),
    );
  };

  const installedCount = agents.filter((agent) => agent.installed).length;

  return (
    <SettingsPageLayout
      title="Agent CLI"
      description="统一安装、升级和配置 Cursor、Claude、Gemini、DeepSeek 等本机 Agent CLI。"
      ariaLabel="Agent CLI"
    >
      <div className={styles.toolbar}>
        <span className={styles.toolbarMeta}>
          {loading ? '正在检测…' : `${installedCount} / ${agents.length} 已安装`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refresh()}
          aria-label="重新检测"
          disabled={loading}
        >
          <Icon name="RefreshCw" size={17} />
        </Button>
      </div>

      {loading && <div className={styles.loading}>正在检测本机 Agent CLI…</div>}
      {!loading && error && <div className={styles.empty}>{error}</div>}
      {!loading && !error && (
        <div className={styles.grid}>
          {agents.map((agent) => (
            <AgentCliCard
              key={agent.id}
              agent={agent}
              onAgentsChange={handleAgentsChange}
              onAgentConfigSaved={handleAgentConfigSaved}
            />
          ))}
        </div>
      )}
    </SettingsPageLayout>
  );
};

export default AgentCliPage;

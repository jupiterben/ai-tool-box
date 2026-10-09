import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import type { AgentCliConfig, AgentCliId, AgentCliInfo } from '../../types/agent-cli';
import styles from './AgentCliPage.module.css';

const BRAND: Record<AgentCliId, string> = {
  cursor: 'CU',
  claude: 'CL',
  gemini: 'GE',
  openclaw: 'OC',
  codex: 'CX',
  opencode: 'OP',
  hermes: 'HE',
  deepseek: 'DS',
};

interface AgentCliCardProps {
  agent: AgentCliInfo;
  onAgentsChange: (agents: AgentCliInfo[]) => void;
  onAgentConfigSaved: (id: AgentCliId, config: AgentCliConfig) => void;
}

const AgentCliCard: React.FC<AgentCliCardProps> = ({
  agent,
  onAgentsChange,
  onAgentConfigSaved,
}) => {
  const [draft, setDraft] = useState<AgentCliConfig>(agent.config);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(agent.config);
  }, [agent.id, agent.config]);

  const installOrUpgrade = async () => {
    setBusy(true);
    setMessage(`${agent.installed ? '正在升级' : '正在安装'} ${agent.name}…`);
    const result = await window.electronAPI?.installAgentCli(agent.id);
    if (result?.success && result.agents) {
      onAgentsChange(result.agents);
      setMessage(`${agent.name} 已更新到最新版本`);
    } else {
      setMessage(result?.error || '操作失败，请确认已安装 Node.js 与 npm');
    }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    const result = await window.electronAPI?.saveAgentCliConfig(agent.id, draft);
    if (result?.success) {
      if (result.agents) onAgentsChange(result.agents);
      else onAgentConfigSaved(agent.id, draft);
      setMessage('配置已安全保存到本机');
    } else {
      setMessage(result?.error || '保存失败');
    }
    setBusy(false);
  };

  const latestLabel =
    agent.latestVersion
    || (agent.id === 'hermes' ? '由官方安装器管理' : '检测失败');

  return (
    <Card variant="outlined" padding="lg" className={styles.card} aria-label={`${agent.name} 配置`}>
      <header className={styles.cardHeader}>
        <div className={`${styles.logo} ${styles[agent.id]}`}>{BRAND[agent.id]}</div>
        <div className={styles.cardCopy}>
          <div className={styles.titleLine}>
            <h2>{agent.name}</h2>
            <span className={agent.installed ? styles.badgeOk : styles.badgeMuted}>
              {agent.installed ? '已安装' : '未安装'}
            </span>
          </div>
          <p>{agent.description}</p>
        </div>
      </header>

      <div className={styles.metaRow}>
        <span>
          <Icon name="Terminal" size={14} />
          <code title={agent.command}>{agent.command}</code>
        </span>
        <span>
          当前 <b>{agent.version || '—'}</b>
        </span>
        <span>
          最新 <b>{latestLabel}</b>
        </span>
      </div>

      <div className={styles.cardControls}>
        <label className={styles.enableLabel}>
          启用
          <Toggle
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            label={`启用 ${agent.name}`}
          />
        </label>
        <Button onClick={() => void installOrUpgrade()} disabled={busy} size="sm">
          {busy ? '处理中…' : agent.installed ? '升级' : '安装'}
        </Button>
      </div>

      <div className={styles.formGrid}>
        <Input
          label="默认模型"
          value={draft.model}
          placeholder="使用 CLI 默认模型"
          onChange={(e) => setDraft({ ...draft, model: e.target.value })}
        />
        <label className={styles.fieldLabel}>
          权限模式
          <Select
            value={draft.permissionMode}
            onChange={(e) =>
              setDraft({
                ...draft,
                permissionMode: e.target.value as AgentCliConfig['permissionMode'],
              })
            }
          >
            <option value="default">每次确认</option>
            <option value="plan">仅规划</option>
            <option value="auto">自动执行</option>
          </Select>
        </label>
        <Input
          label="API Base URL"
          value={draft.baseUrl}
          placeholder="可选，自定义兼容服务地址"
          onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
        />
        <Input
          label="API Key"
          type="password"
          autoComplete="off"
          value={draft.apiKey}
          placeholder="留空则使用 CLI 登录状态"
          onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
        />
        <div className={styles.fullWidth}>
          <Input
            label="默认启动参数"
            value={draft.defaultArgs}
            placeholder="例如：--verbose --output-format text"
            helperText="参数会在启动该 Agent 时自动追加。"
            onChange={(e) => setDraft({ ...draft, defaultArgs: e.target.value })}
          />
        </div>
      </div>

      <footer className={styles.actions}>
        <div className={styles.feedback} role="status" aria-live="polite">
          {message}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDraft({ ...agent.config })}
          disabled={busy}
        >
          还原
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          保存配置
        </Button>
      </footer>
    </Card>
  );
};

export default AgentCliCard;

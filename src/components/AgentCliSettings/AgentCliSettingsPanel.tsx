import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import type { AgentCliConfig, AgentCliId, AgentCliInfo } from '../../types/agent-cli';
import styles from './AgentCliSettingsPanel.module.css';

const BRAND: Record<AgentCliId, string> = {
  cursor: 'CU', claude: 'CL', gemini: 'GE', openclaw: 'OC', codex: 'CX', opencode: 'OP', hermes: 'HE',
};

const AgentCliSettingsPanel: React.FC = () => {
  const [agents, setAgents] = useState<AgentCliInfo[]>([]);
  const [selectedId, setSelectedId] = useState<AgentCliId>('cursor');
  const [draft, setDraft] = useState<AgentCliConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId), [agents, selectedId]);

  const refresh = async () => {
    setLoading(true);
    const result = await window.electronAPI?.listAgentClis();
    if (result?.success && result.agents) setAgents(result.agents);
    else setMessage(result?.error || '请在桌面应用中管理 Agent CLI');
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (selected) setDraft({ ...selected.config }); }, [selected]);

  const installOrUpgrade = async () => {
    if (!selected) return;
    setBusy(true); setMessage(`${selected.installed ? '正在升级' : '正在安装'} ${selected.name}…`);
    const result = await window.electronAPI?.installAgentCli(selected.id);
    if (result?.success && result.agents) {
      setAgents(result.agents); setMessage(`${selected.name} 已更新到最新版本`);
    } else setMessage(result?.error || '操作失败，请确认已安装 Node.js 与 npm');
    setBusy(false);
  };

  const save = async () => {
    if (!selected || !draft) return;
    setBusy(true);
    const result = await window.electronAPI?.saveAgentCliConfig(selected.id, draft);
    if (result?.success) {
      setAgents((current) => current.map((item) => item.id === selected.id ? { ...item, config: draft } : item));
      setMessage('配置已安全保存到本机');
    } else setMessage(result?.error || '保存失败');
    setBusy(false);
  };

  if (loading) return <div className={styles.loading}>正在检测本机 Agent CLI…</div>;

  return (
    <div className={styles.shell}>
      <aside className={styles.catalog} aria-label="Agent CLI 列表">
        <div className={styles.catalogHeader}>
          <div><h2>Agent CLI</h2><p>{agents.filter((a) => a.installed).length} 个已安装</p></div>
          <Button variant="ghost" size="sm" onClick={() => void refresh()} aria-label="重新检测"><Icon name="RefreshCw" size={17} /></Button>
        </div>
        <div className={styles.agentList}>
          {agents.map((agent) => (
            <button key={agent.id} className={`${styles.agentCard} ${selectedId === agent.id ? styles.selected : ''}`} onClick={() => setSelectedId(agent.id)} aria-pressed={selectedId === agent.id}>
              <span className={`${styles.logo} ${styles[agent.id]}`}>{BRAND[agent.id]}</span>
              <span className={styles.agentCopy}><strong>{agent.name}</strong><small>{agent.installed ? `v${agent.version}` : '未安装'}</small></span>
              <span className={`${styles.dot} ${agent.installed ? styles.online : ''}`} aria-label={agent.installed ? '已安装' : '未安装'} />
            </button>
          ))}
        </div>
      </aside>

      {selected && draft && <section className={styles.detail} aria-label={`${selected.name} 配置`}>
        <header className={styles.hero}>
          <div className={`${styles.heroLogo} ${styles[selected.id]}`}>{BRAND[selected.id]}</div>
          <div className={styles.heroCopy}><div className={styles.titleLine}><h2>{selected.name}</h2><span className={selected.installed ? styles.badgeOk : styles.badgeMuted}>{selected.installed ? '已安装' : '未安装'}</span></div><p>{selected.description}</p></div>
          <Button onClick={() => void installOrUpgrade()} disabled={busy}>{busy ? '处理中…' : selected.installed ? '升级' : '安装'}</Button>
        </header>

        <div className={styles.versionBar}>
          <span><Icon name="Terminal" size={16} />命令 <code>{selected.command}</code></span>
          <span>当前版本 <b>{selected.version || '—'}</b></span>
          <span>最新版本 <b>{selected.latestVersion || (selected.id === 'hermes' ? '由官方安装器管理' : '检测失败')}</b></span>
        </div>

        <div className={styles.formSection}>
          <div className={styles.sectionTitle}><div><h3>运行配置</h3><p>设置默认模型、服务地址与执行方式。</p></div><label className={styles.enableLabel}>启用<Toggle checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} label={`启用 ${selected.name}`} /></label></div>
          <div className={styles.formGrid}>
            <Input label="默认模型" value={draft.model} placeholder="使用 CLI 默认模型" onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
            <label className={styles.fieldLabel}>权限模式<Select value={draft.permissionMode} onChange={(e) => setDraft({ ...draft, permissionMode: e.target.value as AgentCliConfig['permissionMode'] })}><option value="default">每次确认</option><option value="plan">仅规划</option><option value="auto">自动执行</option></Select></label>
            <Input label="API Base URL" value={draft.baseUrl} placeholder="可选，自定义兼容服务地址" onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
            <Input label="API Key" type="password" autoComplete="off" value={draft.apiKey} placeholder="留空则使用 CLI 登录状态" onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} />
          </div>
          <Input label="默认启动参数" value={draft.defaultArgs} placeholder="例如：--verbose --output-format text" helperText="参数会在启动该 Agent 时自动追加。" onChange={(e) => setDraft({ ...draft, defaultArgs: e.target.value })} />
        </div>
        <footer className={styles.actions}><div className={styles.feedback} role="status" aria-live="polite">{message}</div><Button variant="secondary" onClick={() => setDraft({ ...selected.config })} disabled={busy}>还原</Button><Button onClick={() => void save()} disabled={busy}>保存配置</Button></footer>
      </section>}
    </div>
  );
};

export default AgentCliSettingsPanel;

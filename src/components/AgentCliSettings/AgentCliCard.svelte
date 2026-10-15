<script lang="ts">
  import { untrack } from 'svelte';

  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Icon from '../ui/Icon.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import type {
    AgentCliConfig,
    AgentCliId,
    AgentCliInfo,
  } from '../../types/agent-cli';
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
  let { agent, onAgentsChange, onAgentConfigSaved }: AgentCliCardProps =
    $props();
  let draft: AgentCliConfig = $state.raw(untrack(() => agent.config));
  function setDraft(
    next: typeof draft | ((previous: typeof draft) => typeof draft),
  ) {
    draft = typeof next === 'function' ? untrack(() => next(draft)) : next;
  }
  let busy = $state.raw(false);
  function setBusy(
    next: typeof busy | ((previous: typeof busy) => typeof busy),
  ) {
    busy = typeof next === 'function' ? untrack(() => next(busy)) : next;
  }
  let message = $state.raw('');
  function setMessage(
    next: typeof message | ((previous: typeof message) => typeof message),
  ) {
    message = typeof next === 'function' ? untrack(() => next(message)) : next;
  }
  $effect(() => {
    void agent.id;
    void agent.config;
    return untrack(() => {
      setDraft(agent.config);
    });
  });
  const installOrUpgrade = async () => {
    setBusy(true);
    setMessage(`${agent.installed ? '正在升级' : '正在安装'} ${agent.name}…`);
    const result = await window.desktopAPI?.installAgentCli(agent.id);
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
    const result = await window.desktopAPI?.saveAgentCliConfig(agent.id, draft);
    if (result?.success) {
      if (result.agents) onAgentsChange(result.agents);
      else onAgentConfigSaved(agent.id, draft);
      setMessage('配置已安全保存到本机');
    } else {
      setMessage(result?.error || '保存失败');
    }
    setBusy(false);
  };
  let latestLabel = $derived(
    agent.latestVersion ||
      (agent.id === 'hermes' ? '由官方安装器管理' : '检测失败'),
  );
</script>

<Card
  variant="outlined"
  padding="lg"
  className={styles.card}
  aria-label={`${agent.name} 配置`}
>
  <header class={styles.cardHeader}>
    <div class={`${styles.logo} ${styles[agent.id]}`}>{BRAND[agent.id]}</div>
    <div class={styles.cardCopy}>
      <div class={styles.titleLine}>
        <h2>{agent.name}</h2>
        <span class={agent.installed ? styles.badgeOk : styles.badgeMuted}>
          {#if agent.installed}已安装{:else}未安装{/if}
        </span>
      </div>
      <p>{agent.description}</p>
    </div>
  </header>
  <div class={styles.metaRow}>
    <span>
      <Icon name="Terminal" size={14}></Icon>
      <code title={agent.command}>{agent.command}</code>
    </span> <span> 当前 <b>{agent.version || '—'}</b> </span>
    <span> 最新 <b>{latestLabel}</b> </span>
  </div>
  <div class={styles.cardControls}>
    <label class={styles.enableLabel}>
      启用 <Toggle
        checked={draft.enabled}
        onChange={(e) =>
          setDraft({ ...draft, enabled: e.currentTarget.checked })}
        label={`启用 ${agent.name}`}
      ></Toggle>
    </label>
    <Button onClick={() => void installOrUpgrade()} disabled={busy} size="sm">
      {#if busy}处理中…{:else}{#if agent.installed}升级{:else}安装{/if}{/if}
    </Button>
  </div>
  <div class={styles.formGrid}>
    <Input
      label="默认模型"
      value={draft.model}
      placeholder="使用 CLI 默认模型"
      onChange={(e) => setDraft({ ...draft, model: e.currentTarget.value })}
    ></Input>
    <label class={styles.fieldLabel}>
      权限模式 <Select
        value={draft.permissionMode}
        onChange={(e) =>
          setDraft({
            ...draft,
            permissionMode: e.currentTarget
              .value as AgentCliConfig['permissionMode'],
          })}
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
      onChange={(e) => setDraft({ ...draft, baseUrl: e.currentTarget.value })}
    ></Input>
    <Input
      label="API Key"
      type="password"
      autoComplete="off"
      value={draft.apiKey}
      placeholder="留空则使用 CLI 登录状态"
      onChange={(e) => setDraft({ ...draft, apiKey: e.currentTarget.value })}
    ></Input>
    <div class={styles.fullWidth}>
      <Input
        label="默认启动参数"
        value={draft.defaultArgs}
        placeholder="例如：--verbose --output-format text"
        helperText="参数会在启动该 Agent 时自动追加。"
        onChange={(e) =>
          setDraft({ ...draft, defaultArgs: e.currentTarget.value })}
      ></Input>
    </div>
  </div>
  <footer class={styles.actions}>
    <div class={styles.feedback} role="status" aria-live="polite">
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

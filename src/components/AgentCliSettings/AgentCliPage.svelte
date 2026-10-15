<script lang="ts">
  import { untrack } from 'svelte';

  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import SettingsPageLayout from '../settings/SettingsPageLayout.svelte';
  import type {
    AgentCliConfig,
    AgentCliId,
    AgentCliInfo,
  } from '../../types/agent-cli';
  import AgentCliCard from './AgentCliCard.svelte';
  import styles from './AgentCliPage.module.css';

  let agents: AgentCliInfo[] = $state.raw([]);
  function setAgents(
    next: typeof agents | ((previous: typeof agents) => typeof agents),
  ) {
    agents = typeof next === 'function' ? untrack(() => next(agents)) : next;
  }
  let loading = $state.raw(true);
  function setLoading(
    next: typeof loading | ((previous: typeof loading) => typeof loading),
  ) {
    loading = typeof next === 'function' ? untrack(() => next(loading)) : next;
  }
  let error = $state.raw('');
  function setError(
    next: typeof error | ((previous: typeof error) => typeof error),
  ) {
    error = typeof next === 'function' ? untrack(() => next(error)) : next;
  }
  const refresh = async () => {
    setLoading(true);
    setError('');
    const result = await window.desktopAPI?.listAgentClis();
    if (result?.success && result.agents) {
      setAgents(result.agents);
    } else {
      setError(result?.error || '请在桌面应用中管理 Agent CLI');
    }
    setLoading(false);
  };
  $effect(() => {
    void refresh;
    return untrack(() => {
      void refresh();
    });
  });
  const handleAgentsChange = (next: AgentCliInfo[]) => {
    setAgents(next);
  };
  const handleAgentConfigSaved = (id: AgentCliId, config: AgentCliConfig) => {
    setAgents((current) =>
      current.map((item) => (item.id === id ? { ...item, config } : item)),
    );
  };
  let installedCount = $derived(
    agents.filter((agent) => agent.installed).length,
  );
</script>

<SettingsPageLayout
  title="Agent CLI"
  description="统一安装、升级和配置 Cursor、Claude、Gemini、DeepSeek 等本机 Agent CLI。"
  ariaLabel="Agent CLI"
>
  <div class={styles.toolbar}>
    <span class={styles.toolbarMeta}>
      {#if loading}正在检测…{:else}{`${installedCount} / ${agents.length} 已安装`}{/if}
    </span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void refresh()}
      aria-label="重新检测"
      disabled={loading}
    >
      <Icon name="RefreshCw" size={17}></Icon>
    </Button>
  </div>
  {#if loading}<div class={styles.loading}>正在检测本机 Agent CLI…</div>{/if}
  {#if !loading && error}<div class={styles.empty}>{error}</div>{/if}
  {#if !loading && !error}<div class={styles.grid}>
      {#each agents as agent (agent.id)}
        <AgentCliCard
          {agent}
          onAgentsChange={handleAgentsChange}
          onAgentConfigSaved={handleAgentConfigSaved}
        ></AgentCliCard>
      {/each}
    </div>{/if}
</SettingsPageLayout>

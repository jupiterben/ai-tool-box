<script lang="ts">
  import { untrack } from 'svelte';

  import { DEFAULT_PRESET_ID, type PresetMeta } from '../../types/preset';
  import { createPresetId } from '../../state/presetContext.svelte';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Alert from '../ui/Alert.svelte';
  import styles from './PresetSettingsPanel.module.css';

  const currentId = createPresetId();
  let presets: PresetMeta[] = $state.raw([]);
  function setPresets(
    next: typeof presets | ((previous: typeof presets) => typeof presets),
  ) {
    presets = typeof next === 'function' ? untrack(() => next(presets)) : next;
  }
  let openIds: string[] = $state.raw([]);
  function setOpenIds(
    next: typeof openIds | ((previous: typeof openIds) => typeof openIds),
  ) {
    openIds = typeof next === 'function' ? untrack(() => next(openIds)) : next;
  }
  let newName = $state.raw('');
  function setNewName(
    next: typeof newName | ((previous: typeof newName) => typeof newName),
  ) {
    newName = typeof next === 'function' ? untrack(() => next(newName)) : next;
  }
  let renameId: string | null = $state.raw(null);
  function setRenameId(
    next: typeof renameId | ((previous: typeof renameId) => typeof renameId),
  ) {
    renameId =
      typeof next === 'function' ? untrack(() => next(renameId)) : next;
  }
  let renameValue = $state.raw('');
  function setRenameValue(
    next:
      | typeof renameValue
      | ((previous: typeof renameValue) => typeof renameValue),
  ) {
    renameValue =
      typeof next === 'function' ? untrack(() => next(renameValue)) : next;
  }
  let busy = $state.raw(false);
  function setBusy(
    next: typeof busy | ((previous: typeof busy) => typeof busy),
  ) {
    busy = typeof next === 'function' ? untrack(() => next(busy)) : next;
  }
  let message: string | null = $state.raw(null);
  function setMessage(
    next: typeof message | ((previous: typeof message) => typeof message),
  ) {
    message = typeof next === 'function' ? untrack(() => next(message)) : next;
  }
  let error: string | null = $state.raw(null);
  function setError(
    next: typeof error | ((previous: typeof error) => typeof error),
  ) {
    error = typeof next === 'function' ? untrack(() => next(error)) : next;
  }
  const refresh = async () => {
    if (!window.desktopAPI?.listPresets) {
      setError('Preset API 不可用，请重启应用');
      return;
    }
    const result = await window.desktopAPI.listPresets();
    if (result?.success && result.presets) {
      setPresets(result.presets);
      setOpenIds(result.openIds ?? []);
    } else {
      setError(result?.error ?? '读取 Preset 失败');
    }
  };
  $effect(() => {
    void refresh;
    return untrack(() => {
      void refresh();
    });
  });
  const handleCreate = async () => {
    setError(null);
    setMessage(null);
    const name = newName.trim();
    if (!name) {
      setError('请输入 Preset 名称');
      return;
    }
    if (!window.desktopAPI?.createPreset) {
      setError('创建 API 不可用，请重启应用');
      return;
    }
    setBusy(true);
    try {
      const result = await window.desktopAPI.createPreset(name);
      if (!result?.success || !result.preset) {
        setError(result?.error ?? '创建失败');
        return;
      }
      setNewName('');
      setMessage(`已创建「${result.preset.name}」`);
      await refresh();
      const opened = await window.desktopAPI.openPreset?.(result.preset.id);
      if (opened && !opened.success) {
        setError(opened.error ?? '创建成功，但打开窗口失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };
  const handleRenameSave = async () => {
    if (!renameId) return;
    const next = renameValue.trim();
    if (!next) {
      setError('名称不能为空');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.desktopAPI?.renamePreset(renameId, next);
      if (!result?.success) {
        setError(result?.error ?? '重命名失败');
        return;
      }
      setRenameId(null);
      setRenameValue('');
      setMessage('已重命名');
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const handleDelete = async (id: string, name: string) => {
    if (id === DEFAULT_PRESET_ID) return;
    if (!window.confirm(`确定删除 Preset「${name}」？登录态与设置将被清除。`))
      return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.desktopAPI?.deletePreset(id);
      if (!result?.success) {
        setError(result?.error ?? '删除失败');
        return;
      }
      setMessage(`已删除「${name}」`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const handleOpen = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.desktopAPI?.openPreset(id);
      if (!result?.success) {
        setError(result?.error ?? '打开失败');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };
</script>

<div class={styles.panel}>
  <Alert variant="info">
    切换 Preset 会新开窗口（每个 Preset 最多一窗）。同 Preset
    内站点共享登录态与上游代理；按站分流请在本机 Clash 等代理中配置规则。
  </Alert>
  <div class={styles.createRow}>
    <Input
      label="新建名称"
      value={newName}
      onChange={(e) => setNewName(e.currentTarget.value)}
      placeholder="例如：工作"
      disabled={busy}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void handleCreate();
        }
      }}
    ></Input>
    <Button
      onClick={() => void handleCreate()}
      disabled={busy || !newName.trim()}
    >
      创建并打开
    </Button>
  </div>
  {#if error}<Alert variant="error">{error}</Alert>{/if}
  {#if message}<Alert variant="success">{message}</Alert>{/if}
  <div class={styles.list}>
    {#each presets as preset (preset.id)}
      <article class={styles.card}>
        <div class={styles.cardMain}>
          {#if renameId === preset.id}<Input
              label="重命名"
              value={renameValue}
              onChange={(e) => setRenameValue(e.currentTarget.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleRenameSave();
                }
                if (e.key === 'Escape') {
                  setRenameId(null);
                }
              }}
            ></Input>{:else}
            <strong>
              {preset.name}
              {#if preset.id === currentId}（本窗）{:else}{/if}
            </strong>
            <span class={styles.meta}>
              {#if openIds.includes(preset.id)}已打开{:else}未打开{/if}
            </span>
          {/if}
        </div>
        <div class={styles.actions}>
          {#if renameId === preset.id}
            <Button
              size="sm"
              onClick={() => void handleRenameSave()}
              disabled={busy}
            >
              保存
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRenameId(null)}
              disabled={busy}
            >
              取消
            </Button>
          {:else}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleOpen(preset.id)}
              disabled={busy}
            >
              打开
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRenameId(preset.id);
                setRenameValue(preset.name);
              }}
              disabled={busy}
            >
              重命名
            </Button>
            {#if preset.id !== DEFAULT_PRESET_ID}<Button
                size="sm"
                variant="outline"
                onClick={() => void handleDelete(preset.id, preset.name)}
                disabled={busy}
              >
                删除
              </Button>{/if}
          {/if}
        </div>
      </article>
    {/each}
  </div>
</div>

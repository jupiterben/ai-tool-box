<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import styles from './MultiWebviewTool.module.css';

  let {
    open,
    size,
    onResize,
    children,
    summary,
  }: {
    open: boolean;
    size: number;
    onResize: (size: number) => void;
    children: Snippet;
    summary: Snippet;
  } = $props();
  let container: HTMLDivElement;
  let width = $state(1000);
  let resizing = $state(false);
  let maximum = $derived(Math.floor(width * 0.7));
  let minimum = $derived(Math.min(280, maximum));
  let actualSize = $derived(Math.max(minimum, Math.min(size, maximum)));

  onMount(() => {
    const observer = new ResizeObserver((entries) => {
      width = entries[0].contentRect.width;
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  function drag(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (event.button !== 0) return;
    event.preventDefault();
    resizing = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!resizing) return;
    onResize(
      Math.max(
        minimum,
        Math.min(
          maximum,
          container.getBoundingClientRect().right - event.clientX,
        ),
      ),
    );
  }

  function keydown(event: KeyboardEvent) {
    const next =
      event.key === 'ArrowLeft'
        ? actualSize + 20
        : event.key === 'ArrowRight'
          ? actualSize - 20
          : event.key === 'Home'
            ? minimum
            : event.key === 'End'
              ? maximum
              : null;
    if (next === null) return;
    event.preventDefault();
    onResize(Math.max(minimum, Math.min(maximum, next)));
  }
</script>

<div
  bind:this={container}
  class={styles.splitter}
  data-resizing={resizing}
  style:grid-template-columns={open
    ? `minmax(0, 1fr) 6px ${actualSize}px`
    : 'minmax(0, 1fr)'}
>
  <div class={styles.workspacePanel}>{@render children()}</div>
  {#if open}
    <!-- A focusable ARIA window splitter supports both pointer and keyboard resizing. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class={styles.resizeHandle}
      role="separator"
      tabindex="0"
      aria-label="调整汇总面板宽度"
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={actualSize}
      onpointerdown={drag}
      onpointermove={move}
      onpointerup={() => {
        resizing = false;
      }}
      onpointercancel={() => {
        resizing = false;
      }}
      onlostpointercapture={() => {
        resizing = false;
      }}
      onkeydown={keydown}
    ></div>
    <div class={styles.summaryPanel}>{@render summary()}</div>
  {/if}
</div>

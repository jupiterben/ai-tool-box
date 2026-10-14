<script lang="ts">
  import type { Snippet } from 'svelte';
  import shared from '../../styles/settings-shared.module.css';
  let {
    title,
    ariaLabel,
    children,
    footer,
    class: className = '',
  }: {
    title: string;
    ariaLabel: string;
    children: Snippet;
    footer?: Snippet;
    class?: string;
  } = $props();
</script>

<div class={`${shared.page} ${className}`} aria-label={ariaLabel}>
  <header class={shared.header}>
    <h1 class={shared.title}>{title}</h1>
  </header>
  {@render children()}
  {#if footer}<footer class={shared.footer}>{@render footer()}</footer>{/if}
</div>

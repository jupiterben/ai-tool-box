<script lang="ts">
  import { type Snippet } from 'svelte';

  import shared from '../../styles/settings-shared.module.css';
  interface SettingsPageLayoutProps {
    title: string;
    description: string;
    ariaLabel: string;
    children: Snippet;
    footer?: Snippet;
    className?: string;
  }
  let {
    title,
    description,
    ariaLabel,
    children,
    footer,
    className = '',
  }: SettingsPageLayoutProps = $props();
</script>

<div
  class={`${shared.page} ${className}`.trim()}
  role="main"
  aria-label={ariaLabel}
>
  <header class={shared.header}>
    <h1 class={shared.title}>{title}</h1>
    <p class={shared.description}>{description}</p>
  </header>
  {@render children?.()}
  {#if footer}<footer class={shared.footer}>{@render footer?.()}</footer>{/if}
</div>

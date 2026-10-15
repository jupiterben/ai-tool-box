<script lang="ts">
  import { icons } from './icons';
  import type { IconName } from '../../types/ui';

  let {
    name,
    size = 20,
    color = 'currentColor',
    className = '',
    strokeWidth = 2,
  }: {
    name: IconName;
    size?: number | string;
    color?: string;
    className?: string;
    strokeWidth?: number;
    'aria-hidden'?: string;
  } = $props();
  let IconComponent = $derived(icons[name as keyof typeof icons]);
</script>

{#if IconComponent}
  <IconComponent
    {size}
    {color}
    class={className}
    {strokeWidth}
    aria-hidden="true"
  />
{/if}

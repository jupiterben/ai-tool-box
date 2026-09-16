<script lang="ts">
  import shared from '../../styles/settings-shared.module.css';
  let { message }: { message: string } = $props();
</script>

<div class={shared.loading} role="status">{message}</div>

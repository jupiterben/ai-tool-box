import { untrack } from 'svelte';

import type { UpdateStatus } from '../types/update-status';
const VISIBLE_STATES = new Set<UpdateStatus['state']>([
  'available',
  'downloading',
  'downloaded',
  'error',
]);
export function createAutoUpdate() {
  let status: UpdateStatus | null = $state.raw(null);
  function setStatus(
    next: typeof status | ((previous: typeof status) => typeof status),
  ) {
    status = typeof next === 'function' ? untrack(() => next(status)) : next;
  }
  $effect(() => {
    return untrack(() => {
      const unsubscribe = window.desktopAPI?.onUpdateStatus?.((nextStatus) => {
        if (
          nextStatus.state === 'not-available' ||
          nextStatus.state === 'checking'
        ) {
          return;
        }
        setStatus(nextStatus);
      });

      return () => {
        unsubscribe?.();
      };
    });
  });
  const installUpdate = async () => {
    await window.desktopAPI?.installUpdate?.();
  };
  const dismiss = () => {
    setStatus(null);
  };
  let visible = $derived.by(
    () => status !== null && VISIBLE_STATES.has(status.state),
  );
  return {
    get status() {
      return status;
    },
    get visible() {
      return visible;
    },
    get installUpdate() {
      return installUpdate;
    },
    get dismiss() {
      return dismiss;
    },
  };
}

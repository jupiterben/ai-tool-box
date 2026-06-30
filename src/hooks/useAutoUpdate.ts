import { useCallback, useEffect, useState } from 'react';
import type { UpdateStatus } from '../types/update-status';

const VISIBLE_STATES = new Set<UpdateStatus['state']>([
  'available',
  'downloading',
  'downloaded',
  'error',
]);

export function useAutoUpdate() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onUpdateStatus?.((nextStatus) => {
      if (nextStatus.state === 'not-available' || nextStatus.state === 'checking') {
        return;
      }
      setStatus(nextStatus);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const installUpdate = useCallback(async () => {
    await window.electronAPI?.installUpdate?.();
  }, []);

  const dismiss = useCallback(() => {
    setStatus(null);
  }, []);

  const visible = status !== null && VISIBLE_STATES.has(status.state);

  return {
    status,
    visible,
    installUpdate,
    dismiss,
  };
}

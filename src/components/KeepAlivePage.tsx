import { memo, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './KeepAlivePage.module.css';

interface KeepAlivePageProps {
  id: string;
  active: boolean;
  children: ReactNode;
}

/** Electron webview 是原生层，CSS 盖不住，只能直接 display:none */
function setWebviewsDisplay(container: HTMLElement | null, visible: boolean): void {
  if (!container) return;
  container.querySelectorAll('webview').forEach((node) => {
    (node as HTMLElement).style.display = visible ? 'inline-flex' : 'none';
  });
}

const KeepAlivePage: React.FC<KeepAlivePageProps> = memo(({ id, active, children }) => {
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    setWebviewsDisplay(slot, active);

    if (active) return;

    const observer = new MutationObserver(() => {
      setWebviewsDisplay(slot, false);
    });
    observer.observe(slot, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      ref={slotRef}
      id={`page-${id}`}
      role="tabpanel"
      aria-hidden={!active}
      {...(!active ? { inert: true } : {})}
      className={`${styles.pageSlot} ${active ? styles.pageSlotActive : styles.pageSlotHidden}`}
    >
      {children}
    </div>
  );
});

KeepAlivePage.displayName = 'KeepAlivePage';

export default KeepAlivePage;

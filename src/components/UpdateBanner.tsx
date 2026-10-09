import { memo } from 'react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { Button } from './ui/Button';
import styles from './UpdateBanner.module.css';

const UpdateBanner: React.FC = memo(() => {
  const { status, visible, installUpdate, dismiss } = useAutoUpdate();

  if (!visible || !status) {
    return null;
  }

  let message: string;
  let action: React.ReactNode = null;

  switch (status.state) {
    case 'available':
      message = status.version
        ? `发现新版本 v${status.version}，正在下载...`
        : '发现新版本，正在下载...';
      break;
    case 'downloading':
      message = `正在下载更新${status.percent != null ? `（${status.percent}%）` : ''}...`;
      break;
    case 'downloaded':
      message = status.version
        ? `新版本 v${status.version} 已就绪`
        : '新版本已就绪';
      action = (
        <>
          <Button variant="primary" size="sm" onClick={() => void installUpdate()}>
            立即重启安装
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            稍后
          </Button>
        </>
      );
      break;
    case 'error':
      message = status.message ? `更新检查失败：${status.message}` : '更新检查失败';
      action = (
        <Button variant="ghost" size="sm" onClick={dismiss}>
          关闭
        </Button>
      );
      break;
    default:
      return null;
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.message}>{message}</span>
      {action ? <div className={styles.actions}>{action}</div> : null}
    </div>
  );
});

UpdateBanner.displayName = 'UpdateBanner';

export default UpdateBanner;

import { memo, useCallback, KeyboardEvent, useMemo } from 'react';
import styles from './UnifiedInput.module.css';

interface UnifiedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  isSending?: boolean;
  maxLength?: number;
  placeholder?: string;
}

const UnifiedInput: React.FC<UnifiedInputProps> = memo(({
  value,
  onChange,
  onSend,
  isSending = false,
  maxLength = 1000,
  placeholder = '输入您的问题...',
}) => {
  // 使用 useMemo 优化计算
  const trimmedValue = useMemo(() => value.trim(), [value]);
  const canSend = useMemo(() => !isSending && trimmedValue.length > 0, [isSending, trimmedValue]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSend) {
          onSend(trimmedValue);
        }
      }
    },
    [canSend, onSend, trimmedValue]
  );

  const handleSend = useCallback(() => {
    if (canSend) {
      onSend(trimmedValue);
    }
  }, [canSend, onSend, trimmedValue]);

  return (
    <div className={styles.container} role="region" aria-label="统一输入区域">
      <div className={styles.inputWrapper}>
        <textarea
          className={styles.textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isSending}
          rows={3}
          aria-label="输入您的问题"
          aria-describedby="input-counter"
        />
        <div className={styles.footer}>
          <span id="input-counter" className={styles.counter} aria-live="polite">
            {value.length}/{maxLength}
          </span>
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!canSend}
            aria-label="发送消息"
            aria-disabled={!canSend}
          >
            {isSending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
});

UnifiedInput.displayName = 'UnifiedInput';

export default UnifiedInput;

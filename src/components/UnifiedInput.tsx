import { memo, useCallback, useMemo, useRef, KeyboardEvent, ChangeEvent } from 'react';
import Icon from './ui/Icon';
import {
  REFERENCE_IMAGE_ACCEPT,
  REFERENCE_IMAGE_MAX_BYTES,
  type ReferenceImage,
} from '../types/reference-image';
import styles from './UnifiedInput.module.css';

interface UnifiedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  isSending?: boolean;
  maxLength?: number;
  placeholder?: string;
  enableReferenceImage?: boolean;
  referenceImage?: ReferenceImage | null;
  onReferenceImageChange?: (image: ReferenceImage | null) => void;
  referenceImageError?: string | null;
  onReferenceImageError?: (message: string | null) => void;
}

function readFileAsReferenceImage(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('读取图片失败'));
        return;
      }
      resolve({
        name: file.name,
        mimeType: file.type || 'image/png',
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

const UnifiedInput: React.FC<UnifiedInputProps> = memo(({
  value,
  onChange,
  onSend,
  isSending = false,
  maxLength = 1000,
  placeholder = '输入您的问题...',
  enableReferenceImage = false,
  referenceImage = null,
  onReferenceImageChange,
  referenceImageError = null,
  onReferenceImageError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedValue = useMemo(() => value.trim(), [value]);
  const canSend = useMemo(
    () =>
      !isSending &&
      (trimmedValue.length > 0 || (enableReferenceImage && Boolean(referenceImage))),
    [isSending, trimmedValue, enableReferenceImage, referenceImage]
  );

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

  const handlePickReferenceImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReferenceFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !onReferenceImageChange) return;

      if (!file.type.startsWith('image/')) {
        onReferenceImageError?.('请选择图片文件');
        return;
      }
      if (file.size > REFERENCE_IMAGE_MAX_BYTES) {
        onReferenceImageError?.('图片大小不能超过 10MB');
        return;
      }

      try {
        const image = await readFileAsReferenceImage(file);
        onReferenceImageChange(image);
        onReferenceImageError?.(null);
      } catch {
        onReferenceImageError?.('读取图片失败');
      }
    },
    [onReferenceImageChange, onReferenceImageError]
  );

  const handleRemoveReferenceImage = useCallback(() => {
    onReferenceImageChange?.(null);
    onReferenceImageError?.(null);
  }, [onReferenceImageChange, onReferenceImageError]);

  return (
    <div className={styles.container} role="region" aria-label="统一输入区域">
      <div className={styles.inputWrapper}>
        {enableReferenceImage && referenceImage && (
          <div className={styles.referencePreview} aria-label="参考图预览">
            <img src={referenceImage.dataUrl} alt="参考图" className={styles.referenceThumb} />
            <div className={styles.referenceMeta}>
              <span className={styles.referenceName} title={referenceImage.name}>
                {referenceImage.name}
              </span>
              <button
                type="button"
                className={styles.referenceRemove}
                onClick={handleRemoveReferenceImage}
                disabled={isSending}
                aria-label="移除参考图"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
          </div>
        )}

        {enableReferenceImage && referenceImageError && (
          <p className={styles.referenceError} role="alert">
            {referenceImageError}
          </p>
        )}

        <textarea
          className={styles.textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isSending}
          rows={3}
          aria-label="输入内容"
          aria-describedby="input-counter"
        />
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {enableReferenceImage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={REFERENCE_IMAGE_ACCEPT}
                  className={styles.hiddenFileInput}
                  onChange={handleReferenceFileChange}
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <button
                  type="button"
                  className={styles.attachButton}
                  onClick={handlePickReferenceImage}
                  disabled={isSending}
                  title="上传参考图"
                  aria-label="上传参考图"
                >
                  <Icon name="ImagePlus" size={16} />
                  参考图
                </button>
              </>
            )}
            <span id="input-counter" className={styles.counter} aria-live="polite">
              {value.length}/{maxLength}
            </span>
          </div>
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!canSend}
            aria-label="发送"
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

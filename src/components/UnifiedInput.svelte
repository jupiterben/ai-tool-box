<script lang="ts">
  import Icon from './ui/Icon.svelte';
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
  let {
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
  }: UnifiedInputProps = $props();
  const fileInputRef = { current: null as HTMLInputElement | null };
  const inputId = $props.id();
  let trimmedValue = $derived.by(() => value.trim());
  let canSend = $derived.by(
    () =>
      !isSending &&
      (trimmedValue.length > 0 ||
        (enableReferenceImage && Boolean(referenceImage))),
  );
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (canSend) {
        onSend(trimmedValue);
      }
    }
  };
  const handleSend = () => {
    if (canSend) {
      onSend(trimmedValue);
    }
  };
  const handlePickReferenceImage = () => {
    fileInputRef.current?.click();
  };
  const handleReferenceFileChange = async (
    event: Event & { currentTarget: HTMLInputElement },
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
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
  };
  const handleRemoveReferenceImage = () => {
    onReferenceImageChange?.(null);
    onReferenceImageError?.(null);
  };
</script>

<div class={styles.container} role="region" aria-label="统一输入区域">
  <div class={styles.inputWrapper}>
    {#if enableReferenceImage && referenceImage}<div
        class={styles.referencePreview}
        aria-label="参考图预览"
      >
        <img
          src={referenceImage.dataUrl}
          alt="参考图"
          class={styles.referenceThumb}
        />
        <div class={styles.referenceMeta}>
          <span class={styles.referenceName} title={referenceImage.name}>
            {referenceImage.name}
          </span>
          <button
            type="button"
            class={styles.referenceRemove}
            onclick={handleRemoveReferenceImage}
            disabled={isSending}
            aria-label="移除参考图"
          >
            <Icon name="X" size={14}></Icon>
          </button>
        </div>
      </div>{/if}{#if enableReferenceImage && referenceImageError}<p
        class={styles.referenceError}
        role="alert"
      >
        {referenceImageError}
      </p>{/if}
    <textarea
      class={styles.textarea}
      {value}
      oninput={(e) => onChange(e.currentTarget.value)}
      onkeydown={handleKeyDown}
      {placeholder}
      maxlength={maxLength}
      disabled={isSending}
      rows={3}
      aria-label="输入内容"
      aria-describedby={`${inputId}-counter`}></textarea>
    <div class={styles.footer}>
      <div class={styles.footerLeft}>
        {#if enableReferenceImage}<input
            bind:this={fileInputRef.current}
            type="file"
            accept={REFERENCE_IMAGE_ACCEPT}
            class={styles.hiddenFileInput}
            onchange={handleReferenceFileChange}
            aria-hidden="true"
            tabindex={-1}
          />
          <button
            type="button"
            class={styles.attachButton}
            onclick={handlePickReferenceImage}
            disabled={isSending}
            title="上传参考图"
            aria-label="上传参考图"
          >
            <Icon name="ImagePlus" size={16}></Icon>参考图
          </button>{/if}
        <span
          id={`${inputId}-counter`}
          class={styles.counter}
          aria-live="polite"
        >
          {value.length}/{maxLength}
        </span>
      </div>
      <button
        class={styles.sendButton}
        onclick={handleSend}
        disabled={!canSend}
        aria-label="发送"
        aria-disabled={!canSend}
      >
        {isSending ? '发送中...' : '发送'}
      </button>
    </div>
  </div>
</div>

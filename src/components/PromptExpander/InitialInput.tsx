/**
 * 初始需求输入组件
 * 
 * 允许用户输入初始需求，开始提示词生成流程
 */

import { useState, useCallback, ChangeEvent } from 'react';
import { Button } from '../ui/Button';
import styles from './InitialInput.module.css';

export interface InitialInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

export const InitialInput: React.FC<InitialInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  error: externalError,
}) => {
  const [localError, setLocalError] = useState<string>('');

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      
      // 清除之前的错误
      if (localError) {
        setLocalError('');
      }
    },
    [onChange, localError]
  );

  const validateInput = useCallback((input: string): string => {
    if (!input || input.trim().length === 0) {
      return '请输入初始需求';
    }
    if (input.trim().length < MIN_LENGTH) {
      return `输入内容至少需要${MIN_LENGTH}个字符`;
    }
    if (input.length > MAX_LENGTH) {
      return `输入内容不能超过${MAX_LENGTH}个字符`;
    }
    return '';
  }, []);

  const handleSubmit = useCallback(() => {
    const validationError = validateInput(value);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    onSubmit(value.trim());
  }, [value, onSubmit, validateInput]);

  const handleClear = useCallback(() => {
    onChange('');
    setLocalError('');
  }, [onChange]);

  const characterCount = value.length;
  const isValid = value.trim().length >= MIN_LENGTH && value.length <= MAX_LENGTH;
  const error = externalError || localError;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>输入初始需求</h2>
        <p className={styles.description}>
          请描述您想要生成的提示词的基本需求或想法
        </p>
      </div>

      <div className={styles.inputWrapper}>
        <textarea
          className={`${styles.textarea} ${error ? styles['textarea--error'] : ''}`}
          value={value}
          onChange={handleChange}
          placeholder="例如：创建一个待办事项应用，支持添加、删除和标记完成..."
          rows={8}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? 'input-error' : 'input-helper'}
        />
        
        <div className={styles.footer}>
          <div className={styles.characterCount}>
            <span className={characterCount > MAX_LENGTH ? styles['characterCount--warning'] : ''}>
              {characterCount} / {MAX_LENGTH}
            </span>
          </div>
          
          {error && (
            <span id="input-error" className={styles.errorText} role="alert">
              {error}
            </span>
          )}
          
          {!error && (
            <span id="input-helper" className={styles.helperText}>
              {isValid ? '可以开始拓展了' : `至少需要${MIN_LENGTH}个字符`}
            </span>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={disabled || !value}
        >
          清空
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={disabled || !isValid}
        >
          开始拓展
        </Button>
      </div>
    </div>
  );
};

export default InitialInput;

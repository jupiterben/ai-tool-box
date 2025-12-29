import React from 'react';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className={styles.errorContainer} role="alert">
      <div className={styles.errorIcon}>⚠️</div>
      <div className={styles.errorMessage}>{message}</div>
      {onRetry && (
        <button className={styles.retryButton} onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;

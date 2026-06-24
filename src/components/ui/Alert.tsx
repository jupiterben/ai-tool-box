import { HTMLAttributes, ReactNode } from 'react';
import styles from './Alert.module.css';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'error' | 'info' | 'warning';
  children: ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`${styles.alert} ${styles[variant]} ${className}`}
      role={variant === 'error' ? 'alert' : 'status'}
      {...props}
    >
      {children}
    </div>
  );
};

export default Alert;

import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, className = '', disabled, ...props }, ref) => {
    return (
      <label
        className={`${styles.toggle} ${className}`}
        title={disabled ? undefined : props.title}
      >
        <input
          ref={ref}
          type="checkbox"
          className={styles.input}
          disabled={disabled}
          aria-label={label}
          {...props}
        />
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';

export default Toggle;

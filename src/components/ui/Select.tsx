import { SelectHTMLAttributes, forwardRef } from 'react';
import styles from './Select.module.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  compact?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ compact = false, className = '', ...props }, ref) => {
    const classNames = [styles.select, compact && styles.selectCompact, className]
      .filter(Boolean)
      .join(' ');

    return <select ref={ref} className={classNames} {...props} />;
  }
);

Select.displayName = 'Select';

export default Select;

import styles from './SegmentControl.module.css';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function SegmentControl<T extends string = string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className = '',
}: SegmentControlProps<T>) {
  return (
    <div
      className={`${styles.segment} ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.button} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
          disabled={disabled}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentControl;

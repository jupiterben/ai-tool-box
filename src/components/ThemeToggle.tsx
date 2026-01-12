import React from 'react';
import { useTheme } from '../hooks/useTheme';
import Icon from './ui/Icon';
import styles from './ThemeToggle.module.css';

/**
 * 主题切换按钮组件
 * 支持明暗主题切换
 */
export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
      title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
    >
      {theme === 'light' ? (
        <Icon name="Moon" size={20} aria-hidden="true" />
      ) : (
        <Icon name="Sun" size={20} aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;

import React, { ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * 主题提供者组件
 * 初始化主题系统并应用到整个应用
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 使用 useTheme Hook 初始化主题
  useTheme();

  return <>{children}</>;
};

export default ThemeProvider;

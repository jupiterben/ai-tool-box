import React from 'react';
import * as LucideIcons from 'lucide-react';

export type IconName = keyof typeof LucideIcons;

export interface IconProps {
  name: IconName;
  size?: number | string;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

/**
 * Icon 组件
 * 统一使用 lucide-react 图标库
 * 支持主题颜色（通过 currentColor）
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = 'currentColor',
  className = '',
  strokeWidth = 2,
}) => {
  const IconComponent = LucideIcons[name] as React.ComponentType<{
    size?: number | string;
    color?: string;
    className?: string;
    strokeWidth?: number;
  }>;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden="true"
    />
  );
};

export default Icon;

const DEV_STORAGE_SUFFIX = '-dev';

/** Vite 构建时确定：开发构建为 true，正式构建为 false */
export function isDevEnvironment(): boolean {
  return import.meta.env.DEV;
}

/** 为 localStorage 等键名追加环境后缀，避免开发与正式数据互相覆盖 */
export function withAppEnvSuffix(key: string): string {
  return isDevEnvironment() ? `${key}${DEV_STORAGE_SUFFIX}` : key;
}

export const IMAGE_GEN_API_SETTINGS_VERSION = '1.0.0';

export interface ImageGenApiSettings {
  version: string;
  enabled: boolean;
  port: number;
}

export interface ImageGenApiStatus {
  enabled: boolean;
  running: boolean;
  host: string;
  configuredPort: number;
  actualPort?: number;
  accessUrls: string[];
  error?: string;
}

export interface ImageGenApiSettingsResult {
  success: boolean;
  settings?: ImageGenApiSettings;
  status?: ImageGenApiStatus;
  error?: string;
}

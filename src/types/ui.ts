import type { icons } from '../components/ui/icons';

export type IconName = keyof typeof icons;

export interface ToolPage {
  id: string;
  name: string;
  icon?: string;
  iconName?: IconName;
}

export type TauriWebViewElement = HTMLElement & {
  src?: string;
  reload?: () => void;
  goBack?: () => void;
  goForward?: () => void;
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  executeJavaScript?: (code: string) => Promise<unknown>;
  isLoading?: boolean;
  getWebContentsId?: () => number;
};

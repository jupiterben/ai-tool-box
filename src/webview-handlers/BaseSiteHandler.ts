import {
  buildBrowserRuntime,
  buildDefaultNearInputSearch,
  buildInjectScript,
  sendButtonSelectorString,
} from './browserRuntime';
import type { SiteHandlerConfig, WebviewInputSelector } from './types';

export const HANDLER_VERSION = 5;

export abstract class BaseSiteHandler {
  abstract readonly config: SiteHandlerConfig;

  get toolId(): string {
    return this.config.toolId;
  }

  /** 子类可覆写：在输入框附近查找发送按钮的逻辑（注入到页面脚本） */
  protected buildFindSendButtonNearInputBody(): string {
    return buildDefaultNearInputSearch(this.config);
  }

  buildBrowserRuntimeScript(): string {
    return buildBrowserRuntime(this.config, this.buildFindSendButtonNearInputBody());
  }

  buildInjectScript(): string {
    return buildInjectScript(this.config, this.buildFindSendButtonNearInputBody(), HANDLER_VERSION);
  }

  /** 兼容旧 API */
  toSelectorConfig(): WebviewInputSelector {
    return {
      toolId: this.config.toolId,
      selectors: this.config.inputSelectors,
      inputType: this.config.inputType,
      sendButtonSelector: sendButtonSelectorString(this.config) || undefined,
      sendMethod: this.config.sendMethod,
    };
  }
}

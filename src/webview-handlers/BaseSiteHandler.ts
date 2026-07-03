import {
  buildBrowserRuntime,
  buildDefaultNearInputSearch,
  buildInjectScript,
  type InjectScriptOverrides,
  sendButtonSelectorString,
} from './browserRuntime';
import { buildConversationActionScript } from './conversationRuntime';
import { buildExtractImagesScript, buildConvertImagesScript, buildDetectImageOriginsScript } from './imageResultRuntime';
import { buildExtractResponsesScript } from './responseRuntime';
import type { ConversationActionType } from './types';
import type { SiteHandlerConfig, WebviewInputSelector } from './types';

export const HANDLER_VERSION = 19;

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

  /** 子类可覆写：自定义填词/发送逻辑（如千问 Ant Design X） */
  protected buildInjectOverrides(): InjectScriptOverrides | undefined {
    return undefined;
  }

  buildInjectScript(): string {
    return buildInjectScript(
      this.config,
      this.buildFindSendButtonNearInputBody(),
      HANDLER_VERSION,
      this.buildInjectOverrides()
    );
  }

  buildExtractResponsesScript(): string {
    return buildExtractResponsesScript(this.config);
  }

  buildExtractImagesScript(): string {
    return buildExtractImagesScript(this.config);
  }

  buildDetectImageOriginsScript(): string {
    return buildDetectImageOriginsScript(this.config);
  }

  buildConvertImagesScript(originSrcs: string[]): string {
    return buildConvertImagesScript(this.config, originSrcs);
  }

  buildConversationActionScript(action: ConversationActionType): string {
    return buildConversationActionScript(this.config, action);
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

import { BaseSiteHandler } from '../BaseSiteHandler';
import type { InjectScriptOverrides } from '../browserRuntime';
import type { SiteHandlerConfig } from '../types';

/** 供主进程 insertText + 原生点击使用的辅助函数 */
const QIANWEN_NATIVE_HELPERS = `
      window.__qianwenFocusInput__ = function() {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到输入框' };
        input.focus();
        if (typeof input.select === 'function') {
          input.select();
        } else if (input.isContentEditable) {
          var selection = window.getSelection();
          if (selection) {
            var range = document.createRange();
            range.selectNodeContents(input);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
        return { success: true };
      };

      window.__qianwenGetSendCoords__ = function() {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到输入框' };
        var btn = __findSendButtonNearInput(input) || __findSendButtonGlobal();
        if (btn && __isSendReady(btn)) {
          var rect = btn.getBoundingClientRect();
          return {
            success: true,
            ready: true,
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          };
        }
        return { success: true, ready: false, hasBtn: !!btn };
      };

      window.__qianwenVerifySent__ = function(originalContent) {
        var input = __findInputElement();
        var val = '';
        if (input) {
          val = (input.value != null ? input.value : input.textContent || '').trim();
        }
        var orig = (originalContent || '').trim();
        return { sent: val === '' || val !== orig, remaining: val };
      };`;

/** Ant Design X Sender：模拟 ref.insert + onChange */
const QIANWEN_FILL_INPUT = `
      function __fillInput(inputElement, content, configuredType) {
        inputElement.focus();

        if (inputElement.isContentEditable) {
          var selection = window.getSelection();
          if (selection) {
            var range = document.createRange();
            range.selectNodeContents(inputElement);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          try {
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, content);
          } catch (e) {
            inputElement.textContent = content;
            inputElement.dispatchEvent(new InputEvent('input', {
              bubbles: true, cancelable: true, inputType: 'insertText', data: content,
            }));
          }
          return;
        }

        var tracker = inputElement._valueTracker;
        if (tracker) {
          tracker.setValue('');
        }
        var nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(inputElement, content);
        } else {
          inputElement.value = content;
        }
        if (tracker) {
          tracker.setValue(content);
        }
        inputElement.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: true, inputType: 'insertText', data: content,
        }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }`;

/** 合成事件发送 + 校验；未发出则返回 false 以触发主进程原生回退 */
const QIANWEN_SEND_AFTER_FILL = `
          await new Promise(function(r) { setTimeout(r, 200); });
          var sendButton = __findSendButtonNearInput(inputElement) || __findSendButtonGlobal();
          sendButton = await __waitForSendButtonReady(sendButton, inputElement, 5000);
          if (sendButton) {
            __clickElement(sendButton);
          } else {
            __triggerEnter(inputElement);
          }
          await new Promise(function(r) { setTimeout(r, 600); });
          var remaining = (inputElement.value != null
            ? inputElement.value
            : inputElement.textContent || '').trim();
          if (remaining === content.trim()) {
            return { success: false, error: '千问消息未发出（合成事件无效）' };
          }`;

export class QianwenHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'qianwen',
    urlHint: 'qianwen.com',
    urlHints: ['qianwen.com', 'www.qianwen.com', 'tongyi.com'],
    inputSelectors: [
      'textarea.ant-sender-input:not(.ant-sender-input-slot)',
      'div.ant-sender-input.ant-sender-input-slot[contenteditable="true"]',
      'div.ant-sender-input[contenteditable="true"]',
      '.ant-sender-input[contenteditable="true"]',
      'textarea.ant-sender-input',
      'div[role="textbox"][contenteditable="true"]',
      "textarea[placeholder*='千问']",
      "textarea[placeholder*='输入']",
      "textarea[placeholder*='消息']",
      'textarea',
    ],
    inputType: 'textarea',
    sendButtonSelectors: [
      'button.ant-sender-actions-btn.ant-btn-primary:not(.ant-sender-actions-btn-disabled)',
      'button.ant-sender-actions-btn.ant-btn-primary',
      'div.omni-button-content button.ant-btn-primary',
      'button.ant-sender-actions-btn',
      'button[aria-label*="发送"]',
    ],
    nearInputSendSelectors: [
      'button.ant-sender-actions-btn.ant-btn-primary:not(.ant-sender-actions-btn-disabled)',
      'button.ant-sender-actions-btn.ant-btn-primary',
      'div.omni-button-content button.ant-btn-primary',
      'button.ant-sender-actions-btn',
    ],
    sendDisabledClasses: ['ant-sender-actions-btn-disabled'],
    preferNearInputSendButton: true,
    sendButtonWaitMs: 5000,
    sendMethod: 'click',
    responseSelectors: [
      '.ant-bubble-content',
      '[class*="assistant"]',
      '[class*="Assistant"]',
      '.ds-markdown',
      '[data-role="assistant"]',
    ],
    userMessageSelectors: ['[class*="user"]', '[class*="User"]', '[data-role="user"]'],
  };

  protected buildInjectOverrides(): InjectScriptOverrides {
    return {
      extraInjectRuntime: QIANWEN_NATIVE_HELPERS,
      fillInputFunction: QIANWEN_FILL_INPUT,
      sendAfterFillBody: QIANWEN_SEND_AFTER_FILL,
    };
  }
}

export const qianwenHandler = new QianwenHandler();

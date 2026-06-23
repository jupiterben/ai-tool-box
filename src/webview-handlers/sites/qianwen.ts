import { BaseSiteHandler } from '../BaseSiteHandler';
import type { InjectScriptOverrides } from '../browserRuntime';
import type { SiteHandlerConfig } from '../types';

/** 千问 Ant Design X：词槽模式为 contenteditable DIV，须 trusted 输入 + 严格校验 */
const QIANWEN_REACT_RUNTIME = `
      function __qwGetReactFiber(node) {
        if (!node) return null;
        var key = Object.keys(node).find(function(k) {
          return k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0;
        });
        return key ? node[key] : null;
      }

      function __qwGetReactProps(node) {
        if (!node) return null;
        var key = Object.keys(node).find(function(k) { return k.indexOf('__reactProps$') === 0; });
        return key ? node[key] : null;
      }

      function __qwFindFiberFn(inputEl, name) {
        var fiber = __qwGetReactFiber(inputEl);
        if (!fiber) return null;
        var queue = [fiber];
        var seen = [];
        while (queue.length) {
          var f = queue.shift();
          if (!f || seen.indexOf(f) >= 0) continue;
          seen.push(f);
          if (f.memoizedProps && typeof f.memoizedProps[name] === 'function') {
            return f.memoizedProps[name];
          }
          if (f.pendingProps && typeof f.pendingProps[name] === 'function') {
            return f.pendingProps[name];
          }
          if (f.child) queue.push(f.child);
          if (f.sibling) queue.push(f.sibling);
          if (f.return) queue.push(f.return);
        }
        return null;
      }

      function __qwFindDomPropFn(inputEl, name) {
        var node = inputEl;
        for (var depth = 0; depth < 8 && node; depth++) {
          var props = __qwGetReactProps(node);
          if (props && typeof props[name] === 'function') return props[name];
          node = node.parentElement;
        }
        return null;
      }

      function __qwInvokeOnChange(inputEl, newValue) {
        var event = { target: inputEl, currentTarget: inputEl };
        var fns = [];
        var domOnChange = __qwFindDomPropFn(inputEl, 'onChange');
        if (domOnChange) fns.push(domOnChange);
        var fiberOnChange = __qwFindFiberFn(inputEl, 'onChange');
        if (fiberOnChange && fns.indexOf(fiberOnChange) < 0) fns.push(fiberOnChange);

        for (var i = 0; i < fns.length; i++) {
          var fn = fns[i];
          try { fn(newValue); return 'onChange-value'; } catch (e1) {}
          try { fn(newValue, event); return 'onChange-value-event'; } catch (e2) {}
          try { fn(event); return 'onChange-event'; } catch (e3) {}
        }
        return null;
      }

      function __qwGetInputRemaining(inputEl) {
        if (!inputEl) return '';
        if (inputEl.isContentEditable) {
          return (inputEl.innerText || inputEl.textContent || '').replace(/\\s+/g, ' ').trim();
        }
        return (inputEl.value || '').trim();
      }

      function __qwWasMessageSent(inputEl, originalContent) {
        var orig = (originalContent || '').trim();
        var remaining = __qwGetInputRemaining(inputEl);
        if (!orig) return { sent: false, remaining: remaining };
        if (remaining === '') return { sent: true, remaining: '' };
        if (remaining.indexOf(orig) >= 0) return { sent: false, remaining: remaining };
        return { sent: true, remaining: remaining };
      }

      function __qwClearInput(inputEl) {
        inputEl.focus();
        if (inputEl.isContentEditable) {
          var selection = window.getSelection();
          if (selection) {
            var range = document.createRange();
            range.selectNodeContents(inputEl);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
          return;
        }
        var tracker = inputEl._valueTracker;
        if (tracker) tracker.setValue('');
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(inputEl, '');
        else inputEl.value = '';
        if (tracker) tracker.setValue('');
      }

      function __qwSetTextareaValue(inputEl, content) {
        __qwClearInput(inputEl);
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        var tracker = inputEl._valueTracker;
        if (nativeSetter) nativeSetter.call(inputEl, content);
        else inputEl.value = content;
        if (tracker) tracker.setValue(content);
        inputEl.selectionStart = inputEl.selectionEnd = content.length;

        var reactMethod = __qwInvokeOnChange(inputEl, content);
        if (reactMethod) return reactMethod;

        document.execCommand('insertText', false, content);
        return 'textarea-execCommand';
      }

      function __qwSetContentEditableValue(inputEl, content) {
        __qwClearInput(inputEl);
        inputEl.focus();
        document.execCommand('insertText', false, content);
        var text = __qwGetInputRemaining(inputEl);
        var reactMethod = __qwInvokeOnChange(inputEl, text || content);
        if (reactMethod) return reactMethod;
        return 'slot-execCommand';
      }

      function __qwSetInputValue(inputEl, content) {
        if (inputEl.isContentEditable) return __qwSetContentEditableValue(inputEl, content);
        return __qwSetTextareaValue(inputEl, content);
      }

      function __qwTriggerSend(inputEl) {
        var names = ['triggerSend', 'onSubmit', 'handleSubmit'];
        for (var n = 0; n < names.length; n++) {
          var fn = __qwFindFiberFn(inputEl, names[n]);
          if (fn) {
            try { fn(); return names[n]; } catch (e) {}
          }
        }

        var btn = __findSendButtonNearInput(inputEl) || __findSendButtonGlobal();
        if (btn) {
          var btnOnClick = __qwFindDomPropFn(btn, 'onClick') || __qwFindFiberFn(btn, 'onClick');
          if (btnOnClick) {
            try {
              btnOnClick({ preventDefault: function() {}, stopPropagation: function() {}, target: btn, currentTarget: btn });
              return 'btn-onClick';
            } catch (e) {}
          }
          if (__isSendReady(btn)) {
            __clickElement(btn);
            return 'btn-dom-click';
          }
        }

        var onKeyDown = __qwFindFiberFn(inputEl, 'onKeyDown');
        if (onKeyDown) {
          try {
            onKeyDown({
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
              shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
              preventDefault: function() {}, stopPropagation: function() {},
              target: inputEl, currentTarget: inputEl,
            });
            return 'react-keydown-enter';
          } catch (e) {}
        }

        __triggerEnter(inputEl);
        return 'dom-enter';
      }

      async function __qwWaitMessageSent(inputEl, content, maxMs) {
        var start = Date.now();
        while (Date.now() - start < maxMs) {
          var check = __qwWasMessageSent(inputEl, content);
          if (check.sent) return check;
          await new Promise(function(r) { setTimeout(r, 200); });
        }
        return __qwWasMessageSent(inputEl, content);
      }

      window.__qianwenFocusInput__ = function() {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到输入框' };
        input.focus();
        if (typeof input.select === 'function') input.select();
        return { success: true, inputTag: input.tagName, isContentEditable: !!input.isContentEditable };
      };

      window.__qianwenGetSendCoords__ = function() {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到输入框' };
        var btn = __findSendButtonNearInput(input) || __findSendButtonGlobal();
        if (btn && __isSendReady(btn)) {
          var rect = btn.getBoundingClientRect();
          return { success: true, ready: true, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
        }
        return { success: true, ready: false, hasBtn: !!btn, btnDisabled: btn ? !__isSendReady(btn) : null };
      };

      window.__qianwenVerifySent__ = function(originalContent) {
        var input = __findInputElement();
        return __qwWasMessageSent(input, originalContent);
      };`;

const QIANWEN_INJECT_INPUT = `
      window.__injectInput__ = async function(content) {
        try {
          await new Promise(function(r) { setTimeout(r, 300); });

          var inputElement = null;
          for (var attempt = 0; attempt < 5; attempt++) {
            inputElement = __findInputElement();
            if (inputElement) break;
            await new Promise(function(r) { setTimeout(r, 400); });
          }
          if (!inputElement) {
            return { success: false, error: '未找到千问输入框' };
          }

          var inputTag = inputElement.tagName;
          var fillMethod = __qwSetInputValue(inputElement, content);
          await new Promise(function(r) { setTimeout(r, 400); });

          var sendButton = __findSendButtonNearInput(inputElement) || __findSendButtonGlobal();
          var btnReady = !!sendButton && __isSendReady(sendButton);
          if (!btnReady) {
            sendButton = await __waitForSendButtonReady(sendButton, inputElement, 5000);
            btnReady = !!sendButton && __isSendReady(sendButton);
          }

          var sendMethod = __qwTriggerSend(inputElement);
          var verify = await __qwWaitMessageSent(inputElement, content, 2500);

          if (!verify.sent) {
            return {
              success: false,
              error: '千问未发送（剩余: ' + verify.remaining + '）',
              fillMethod: fillMethod,
              sendMethod: sendMethod,
              btnReady: btnReady,
              inputTag: inputTag,
              remaining: verify.remaining,
            };
          }

          return {
            success: true,
            fillMethod: fillMethod,
            sendMethod: sendMethod,
            btnReady: btnReady,
            inputTag: inputTag,
            remaining: verify.remaining,
          };
        } catch (error) {
          return { success: false, error: error.message || '未知错误' };
        }
      };`;

export class QianwenHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'qianwen',
    urlHint: 'qianwen.com',
    urlHints: ['qianwen.com', 'www.qianwen.com', 'tongyi.com'],
    inputSelectors: [
      'div.ant-sender-input.ant-sender-input-slot[contenteditable="true"]',
      'div.ant-sender-input[contenteditable="true"]',
      '.ant-sender-input[contenteditable="true"]',
      'textarea.ant-sender-input:not(.ant-sender-input-slot)',
      'textarea.ant-sender-input',
      'div[role="textbox"][contenteditable="true"]',
      "textarea[placeholder*='千问']",
      'textarea',
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button.ant-sender-actions-btn.ant-btn-primary:not(.ant-sender-actions-btn-disabled)',
      'button.ant-sender-actions-btn.ant-btn-primary',
      'button.ant-sender-actions-btn',
      'button[aria-label*="发送"]',
    ],
    nearInputSendSelectors: [
      'button.ant-sender-actions-btn.ant-btn-primary:not(.ant-sender-actions-btn-disabled)',
      'button.ant-sender-actions-btn.ant-btn-primary',
      'button.ant-sender-actions-btn',
    ],
    sendDisabledClasses: ['ant-sender-actions-btn-disabled'],
    preferNearInputSendButton: true,
    sendButtonWaitMs: 5000,
    sendMethod: 'click',
    responseRootSelectors: [
      '[class*="chat-main"]',
      '[class*="ChatMain"]',
      '[class*="message-list"]',
      '[class*="MessageList"]',
      'main',
    ],
    responseIgnoreTexts: ['最近对话', '新对话', '开启新对话', '历史对话'],
    responseSelectors: [
      '.qwen-chat-message-assistant .response-message-content.phase-answer',
      '.qwen-chat-message-assistant .custom-qwen-markdown',
      '.qwen-chat-message-assistant .qwen-markdown',
      '.chat-response-message .response-message-content.phase-answer',
      '#qk-markdown-react',
      '.chat-answers-card-wrap .custom-qwen-markdown',
      '.ant-bubble-start .ant-bubble-content',
      '.ant-bubble-start .ds-markdown',
      '.ant-bubble.ant-bubble-start .ant-bubble-content',
      '[data-role="assistant"] .ant-bubble-content',
    ],
    userMessageSelectors: [
      '.qwen-chat-message-user .response-message-content',
      '.ant-bubble-end .ant-bubble-content',
      '[data-role="user"]',
    ],
  };

  protected buildInjectOverrides(): InjectScriptOverrides {
    return {
      extraInjectRuntime: QIANWEN_REACT_RUNTIME,
      injectInputFunction: QIANWEN_INJECT_INPUT,
    };
  }
}

export const qianwenHandler = new QianwenHandler();

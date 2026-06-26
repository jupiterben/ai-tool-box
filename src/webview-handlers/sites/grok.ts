import { BaseSiteHandler } from '../BaseSiteHandler';
import type { InjectScriptOverrides } from '../browserRuntime';
import type { SiteHandlerConfig } from '../types';

/** Grok：React 受控输入 + 引用块可能独立于 contenteditable，须一并清理 */
const GROK_REACT_RUNTIME = `
      var __GRK_QUOTE_MARKERS__ = ['参考以下内容', 'Refer to the following', 'refer to the following'];

      function __grkGetReactFiber(node) {
        if (!node) return null;
        var key = Object.keys(node).find(function(k) {
          return k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0;
        });
        return key ? node[key] : null;
      }

      function __grkGetReactProps(node) {
        if (!node) return null;
        var key = Object.keys(node).find(function(k) { return k.indexOf('__reactProps$') === 0; });
        return key ? node[key] : null;
      }

      function __grkFindFiberFn(inputEl, name) {
        var fiber = __grkGetReactFiber(inputEl);
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

      function __grkFindDomPropFn(inputEl, name) {
        var node = inputEl;
        for (var depth = 0; depth < 10 && node; depth++) {
          var props = __grkGetReactProps(node);
          if (props && typeof props[name] === 'function') return props[name];
          node = node.parentElement;
        }
        return null;
      }

      function __grkTextHasQuoteMarker(text) {
        var t = (text || '').trim();
        if (!t) return false;
        for (var i = 0; i < __GRK_QUOTE_MARKERS__.length; i++) {
          if (t.indexOf(__GRK_QUOTE_MARKERS__[i]) >= 0) return true;
        }
        return false;
      }

      function __grkGetInputRemaining(inputEl) {
        if (!inputEl) return '';
        if (inputEl.isContentEditable) {
          return (inputEl.innerText || inputEl.textContent || '').replace(/\\s+/g, ' ').trim();
        }
        return (inputEl.value || '').trim();
      }

      function __grkFindComposeRoot(inputEl) {
        return inputEl.closest('form')
          || inputEl.closest('[data-testid*="composer" i]')
          || inputEl.closest('[class*="composer" i]')
          || inputEl.closest('[class*="input-area" i]')
          || inputEl.closest('[role="group"]')
          || inputEl.parentElement;
      }

      function __grkRemoveQuoteBlocks(inputEl) {
        var root = __grkFindComposeRoot(inputEl);
        for (var depth = 0; depth < 8 && root; depth++) {
          var dismissSelectors = [
            'button[aria-label*="Remove" i]',
            'button[aria-label*="Close" i]',
            'button[aria-label*="Dismiss" i]',
            'button[aria-label*="清除" i]',
            'button[aria-label*="关闭" i]',
            '[data-testid*="remove" i]',
            '[data-testid*="close" i]',
            '[data-testid*="dismiss" i]',
          ];
          for (var s = 0; s < dismissSelectors.length; s++) {
            try {
              var btns = root.querySelectorAll(dismissSelectors[s]);
              for (var b = 0; b < btns.length; b++) {
                var btn = btns[b];
                if (btn && btn.offsetParent !== null) __clickElement(btn);
              }
            } catch (e) {}
          }

          var nodes = root.querySelectorAll('*');
          for (var i = nodes.length - 1; i >= 0; i--) {
            var node = nodes[i];
            if (!node || node === inputEl || inputEl.contains(node)) continue;
            var text = (node.textContent || '').trim();
            if (text && __grkTextHasQuoteMarker(text) && text.length < 500) {
              node.remove();
            }
          }
          root = root.parentElement;
        }
      }

      function __grkInvokeReactHandlers(inputEl, newValue) {
        var event = {
          target: inputEl,
          currentTarget: inputEl,
          preventDefault: function() {},
          stopPropagation: function() {},
          type: 'input',
          inputType: 'insertText',
          data: newValue,
        };
        var names = ['onChange', 'onInput', 'onBeforeInput'];
        var methods = [];
        for (var n = 0; n < names.length; n++) {
          var name = names[n];
          var domFn = __grkFindDomPropFn(inputEl, name);
          if (domFn) methods.push({ fn: domFn, name: 'dom-' + name });
          var fiberFn = __grkFindFiberFn(inputEl, name);
          if (fiberFn && methods.every(function(m) { return m.fn !== fiberFn; })) {
            methods.push({ fn: fiberFn, name: 'fiber-' + name });
          }
        }

        for (var i = 0; i < methods.length; i++) {
          var fn = methods[i].fn;
          try { fn(newValue); return methods[i].name + '-value'; } catch (e1) {}
          try { fn(newValue, event); return methods[i].name + '-value-event'; } catch (e2) {}
          try { fn(event); return methods[i].name + '-event'; } catch (e3) {}
        }
        return null;
      }

      function __grkClearInput(inputEl) {
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
          inputEl.textContent = '';
          inputEl.innerHTML = '';
          return;
        }
        var tracker = inputEl._valueTracker;
        if (tracker) tracker.setValue('');
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(inputEl, '');
        else inputEl.value = '';
        if (tracker) tracker.setValue('');
      }

      function __grkSetInputValue(inputEl, content) {
        __grkRemoveQuoteBlocks(inputEl);
        __grkClearInput(inputEl);
        inputEl.focus();

        if (inputEl.isContentEditable) {
          document.execCommand('insertText', false, content);
        } else {
          var tracker = inputEl._valueTracker;
          var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(inputEl, content);
          else inputEl.value = content;
          if (tracker) tracker.setValue(content);
          inputEl.selectionStart = inputEl.selectionEnd = content.length;
        }

        var reactMethod = __grkInvokeReactHandlers(inputEl, content);
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: content }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

        var remaining = __grkGetInputRemaining(inputEl);
        if (__grkTextHasQuoteMarker(remaining) || (remaining && remaining !== content.trim() && remaining.indexOf(content.trim()) < 0)) {
          __grkRemoveQuoteBlocks(inputEl);
          __grkClearInput(inputEl);
          if (inputEl.isContentEditable) {
            document.execCommand('insertText', false, content);
          } else {
            var tracker2 = inputEl._valueTracker;
            var setter2 = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (setter2) setter2.call(inputEl, content);
            else inputEl.value = content;
            if (tracker2) tracker2.setValue(content);
          }
          __grkInvokeReactHandlers(inputEl, content);
          remaining = __grkGetInputRemaining(inputEl);
        }

        return { reactMethod: reactMethod, remaining: remaining };
      }

      function __grkWasMessageSent(inputEl, originalContent) {
        var orig = (originalContent || '').trim();
        var remaining = __grkGetInputRemaining(inputEl);
        if (__grkTextHasQuoteMarker(remaining)) {
          return { sent: false, remaining: remaining, hasPrefix: true };
        }
        if (!orig) return { sent: false, remaining: remaining };
        if (remaining === '') return { sent: true, remaining: '' };
        if (remaining === orig) return { sent: false, remaining: remaining };
        if (remaining.indexOf(orig) >= 0) return { sent: false, remaining: remaining };
        return { sent: true, remaining: remaining };
      }

      function __grkTriggerSend(inputEl) {
        var btn = __findSendButtonNearInput(inputEl) || __findSendButtonGlobal();
        if (btn) {
          var btnOnClick = __grkFindDomPropFn(btn, 'onClick') || __grkFindFiberFn(btn, 'onClick');
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

        var onKeyDown = __grkFindFiberFn(inputEl, 'onKeyDown') || __grkFindDomPropFn(inputEl, 'onKeyDown');
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

      async function __grkWaitMessageSent(inputEl, content, maxMs) {
        var start = Date.now();
        while (Date.now() - start < maxMs) {
          var check = __grkWasMessageSent(inputEl, content);
          if (check.sent) return check;
          await new Promise(function(r) { setTimeout(r, 200); });
        }
        return __grkWasMessageSent(inputEl, content);
      }

      window.__grokPrepareInput__ = function() {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到 Grok 输入框' };
        __grkRemoveQuoteBlocks(input);
        __grkClearInput(input);
        __grkInvokeReactHandlers(input, '');
        input.focus();
        return {
          success: true,
          inputTag: input.tagName,
          isContentEditable: !!input.isContentEditable,
        };
      };

      window.__grokSyncInput__ = function(content) {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到 Grok 输入框' };
        var result = __grkSetInputValue(input, content);
        return {
          success: !__grkTextHasQuoteMarker(result.remaining),
          remaining: result.remaining,
          reactMethod: result.reactMethod,
        };
      };

      window.__grokGetSendCoords__ = function() {
        var input = __findInputElement();
        if (!input) return { success: false, error: '未找到 Grok 输入框' };
        var btn = __findSendButtonNearInput(input) || __findSendButtonGlobal();
        if (btn && __isSendReady(btn)) {
          var rect = btn.getBoundingClientRect();
          return { success: true, ready: true, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
        }
        return { success: true, ready: false, hasBtn: !!btn, btnDisabled: btn ? !__isSendReady(btn) : null };
      };

      window.__grokVerifySent__ = function(originalContent) {
        var input = __findInputElement();
        return __grkWasMessageSent(input, originalContent);
      };`;

const GROK_INJECT_INPUT = `
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
            return { success: false, error: '未找到 Grok 输入框' };
          }

          var inputTag = inputElement.tagName;
          var fillResult = __grkSetInputValue(inputElement, content);
          if (__grkTextHasQuoteMarker(fillResult.remaining)) {
            return {
              success: false,
              error: 'Grok 输入仍含引用前缀: ' + fillResult.remaining,
              fillMethod: fillResult.reactMethod,
              inputTag: inputTag,
              remaining: fillResult.remaining,
            };
          }

          await new Promise(function(r) { setTimeout(r, 400); });

          var sendButton = __findSendButtonNearInput(inputElement) || __findSendButtonGlobal();
          var btnReady = !!sendButton && __isSendReady(sendButton);
          if (!btnReady) {
            sendButton = await __waitForSendButtonReady(sendButton, inputElement, 5000);
            btnReady = !!sendButton && __isSendReady(sendButton);
          }

          var sendMethod = __grkTriggerSend(inputElement);
          var verify = await __grkWaitMessageSent(inputElement, content, 3000);

          if (!verify.sent) {
            return {
              success: false,
              error: verify.hasPrefix
                ? 'Grok 未发送（仍含引用前缀: ' + verify.remaining + '）'
                : 'Grok 未发送（剩余: ' + verify.remaining + '）',
              fillMethod: fillResult.reactMethod,
              sendMethod: sendMethod,
              btnReady: btnReady,
              inputTag: inputTag,
              remaining: verify.remaining,
            };
          }

          return {
            success: true,
            fillMethod: fillResult.reactMethod,
            sendMethod: sendMethod,
            btnReady: btnReady,
            inputTag: inputTag,
            remaining: verify.remaining,
          };
        } catch (error) {
          return { success: false, error: error.message || '未知错误' };
        }
      };`;

export class GrokHandler extends BaseSiteHandler {
  readonly config: SiteHandlerConfig = {
    toolId: 'grok',
    urlHint: 'grok.com',
    urlHints: ['grok.com'],
    inputSelectors: [
      "textarea[data-testid='grok-input']",
      '[contenteditable="true"][data-testid*="input" i]',
      '[contenteditable="true"][aria-label*="message" i]',
      '[contenteditable="true"][aria-label*="Ask" i]',
      'div[role="textbox"][contenteditable="true"]',
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='问']",
    ],
    inputType: 'contenteditable',
    sendButtonSelectors: [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="发送" i]',
      "button[type='submit']",
    ],
    nearInputSendSelectors: [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="发送" i]',
    ],
    preferNearInputSendButton: true,
    sendButtonWaitMs: 5000,
    sendMethod: 'click',
    responseSelectors: [
      '[data-testid="grok-response"]',
      '.grok-response',
      "[class*='response']",
    ],
    userMessageSelectors: [
      '[data-testid="user-message"]',
      '.user-message',
    ],
    newChatAction: {
      url: 'https://grok.com/',
      textIncludes: ['New chat', '新对话'],
    },
    recentChatAction: {
      conversationList: {
        containerSelectors: ['aside', '[class*="sidebar"]', 'nav'],
        itemSelectors: ['a', '[role="button"]', '[role="link"]'],
        skipTextIncludes: ['New chat', '新对话'],
        index: 0,
      },
    },
  };

  protected buildInjectOverrides(): InjectScriptOverrides {
    return {
      extraInjectRuntime: GROK_REACT_RUNTIME,
      injectInputFunction: GROK_INJECT_INPUT,
    };
  }
}

export const grokHandler = new GrokHandler();

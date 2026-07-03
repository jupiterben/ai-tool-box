import type { ReferenceImageConfig, SiteHandlerConfig } from './types';

function json(value: unknown): string {
  return JSON.stringify(value);
}

function sendButtonSelectorString(config: SiteHandlerConfig): string {
  return config.sendButtonSelectors?.join(', ') ?? '';
}

/** 默认：从 input 父级向上查找 nearInputSendSelectors */
export function buildDefaultNearInputSearch(config: SiteHandlerConfig): string {
  const nearSelectors = json(config.nearInputSendSelectors ?? []);
  return `
    var nearSelectors = ${nearSelectors};
    var container = inputEl.parentElement;
    for (var depth = 0; depth < 12 && container && container !== document.body; depth++) {
      for (var n = 0; n < nearSelectors.length; n++) {
        var nearBtns = container.querySelectorAll(nearSelectors[n]);
        if (nearBtns.length) return nearBtns[nearBtns.length - 1];
      }
      container = container.parentElement;
    }
    return null;
  `;
}

/** DeepSeek：ds-icon-button，跳过 stop 按钮（svg 含 rect） */
export const DEEPSEEK_NEAR_INPUT_SEARCH = `
  var container = inputEl.parentElement;
  for (var depth = 0; depth < 12 && container && container !== document.body; depth++) {
    var dsBtns = container.querySelectorAll('[role="button"].ds-icon-button');
    for (var j = 0; j < dsBtns.length; j++) {
      var candidate = dsBtns[j];
      var svg = candidate.querySelector('svg');
      if (svg && svg.querySelector('rect')) continue;
      return candidate;
    }
    container = container.parentElement;
  }
  return null;
`;

export interface InjectScriptOverrides {
  /** 替换默认 __fillInput 函数体（含 function 声明） */
  fillInputFunction?: string;
  /** 替换填词后的发送逻辑（不含 sendMethod 分支） */
  sendAfterFillBody?: string;
  /** 注入到 runtime 之后的额外脚本（如千问 React 辅助函数） */
  extraInjectRuntime?: string;
  /** 完全替换 window.__injectInput__（千问等 React 受控站点） */
  injectInputFunction?: string;
}

export function buildReferenceImageRuntime(config: ReferenceImageConfig): string {
  const inputSelectors = json(
    config.inputSelectors ?? ['input[type="file"][accept*="image"]', 'input[type="file"]']
  );
  const triggerSelectors = json(config.triggerSelectors ?? []);
  const waitAfterUploadMs = config.waitAfterUploadMs ?? 800;

  return `
    var __REF_IMAGE_INPUT_SELECTORS__ = ${inputSelectors};
    var __REF_IMAGE_TRIGGER_SELECTORS__ = ${triggerSelectors};
    var __REF_IMAGE_WAIT_MS__ = ${waitAfterUploadMs};

    async function __assignFileToInput(input, imageData) {
      var res = await fetch(imageData.dataUrl);
      var blob = await res.blob();
      var file = new File(
        [blob],
        imageData.name || 'reference.png',
        { type: imageData.mimeType || blob.type || 'image/png' }
      );
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    async function __tryUploadToFileInputs(imageData) {
      for (var i = 0; i < __REF_IMAGE_INPUT_SELECTORS__.length; i++) {
        var selector = __REF_IMAGE_INPUT_SELECTORS__[i];
        var inputs;
        try {
          inputs = document.querySelectorAll(selector);
        } catch (e) {
          continue;
        }
        for (var j = 0; j < inputs.length; j++) {
          var input = inputs[j];
          if (!input || input.type !== 'file' || input.disabled) continue;
          try {
            await __assignFileToInput(input, imageData);
            return { success: true, method: 'file-input', selector: selector };
          } catch (e) {}
        }
      }
      return null;
    }

    async function __uploadReferenceImage(imageData) {
      if (!imageData || !imageData.dataUrl) {
        return { success: false, error: '参考图数据无效' };
      }

      var direct = await __tryUploadToFileInputs(imageData);
      if (direct) return direct;

      for (var t = 0; t < __REF_IMAGE_TRIGGER_SELECTORS__.length; t++) {
        var triggerSel = __REF_IMAGE_TRIGGER_SELECTORS__[t];
        var trigger;
        try {
          trigger = document.querySelector(triggerSel);
        } catch (e) {
          continue;
        }
        if (!trigger) continue;
        __clickElement(trigger);
        await new Promise(function(r) { setTimeout(r, 500); });
        direct = await __tryUploadToFileInputs(imageData);
        if (direct) return direct;
      }

      return { success: false, error: '未找到参考图上传控件' };
    }
  `;
}

export function buildBrowserRuntime(
  config: SiteHandlerConfig,
  findSendButtonNearInputBody: string
): string {
  const disabledClasses = json(config.sendDisabledClasses ?? ['ant-sender-actions-btn-disabled']);
  const inputSelectors = json(config.inputSelectors);
  const inputRootSelectors = json(config.inputRootSelectors ?? []);
  const sendSelectorStr = json(sendButtonSelectorString(config));
  const preferNear = config.preferNearInputSendButton === true;
  const findSendButtonBody = preferNear
    ? 'return __findSendButtonNearInput(inputEl) || __findSendButtonGlobal();'
    : 'return __findSendButtonGlobal() || __findSendButtonNearInput(inputEl);';

  return `
    var __SITE_INPUT_SELECTORS__ = ${inputSelectors};
    var __SITE_INPUT_ROOT_SELECTORS__ = ${inputRootSelectors};
    var __SITE_SEND_SELECTOR__ = ${sendSelectorStr};
    var __SITE_SEND_DISABLED_CLASSES__ = ${disabledClasses};

    function __findInputSearchRoot() {
      if (!__SITE_INPUT_ROOT_SELECTORS__.length) return document;
      for (var i = 0; i < __SITE_INPUT_ROOT_SELECTORS__.length; i++) {
        try {
          var root = document.querySelector(__SITE_INPUT_ROOT_SELECTORS__[i]);
          if (root) return root;
        } catch (e) {}
      }
      return document;
    }

    function __isVisibleInput(el) {
      if (!el || el.disabled || el.readOnly) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      if (el.closest('[aria-hidden="true"]')) return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function __findInputElement() {
      var searchRoot = __findInputSearchRoot();
      for (var i = 0; i < __SITE_INPUT_SELECTORS__.length; i++) {
        try {
          var el = searchRoot.querySelector(__SITE_INPUT_SELECTORS__[i]);
          if (el && __isVisibleInput(el)) return el;
        } catch (e) {}
      }
      return null;
    }

    function __isSendReady(btn) {
      if (!btn) return false;
      if (btn.getAttribute('aria-disabled') === 'true') return false;
      if (btn.disabled) return false;
      for (var c = 0; c < __SITE_SEND_DISABLED_CLASSES__.length; c++) {
        if (btn.classList && btn.classList.contains(__SITE_SEND_DISABLED_CLASSES__[c])) return false;
      }
      return true;
    }

    function __findSendButtonGlobal() {
      if (!__SITE_SEND_SELECTOR__) return null;
      var parts = __SITE_SEND_SELECTOR__.split(',');
      for (var i = 0; i < parts.length; i++) {
        var sel = parts[i].trim();
        if (!sel) continue;
        try {
          var btn = document.querySelector(sel);
          if (btn) return btn;
        } catch (e) {}
      }
      return null;
    }

    function __findSendButtonNearInput(inputEl) {
      ${findSendButtonNearInputBody}
    }

    function __findSendButton(inputEl) {
      ${findSendButtonBody}
    }

    function __focusInput() {
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
      return { success: true, tag: input.tagName };
    }

    function __getSendButtonPosition() {
      var input = __findInputElement();
      if (!input) return { success: false, error: '未找到输入框' };
      var sendBtn = __findSendButton(input);
      if (sendBtn && __isSendReady(sendBtn)) {
        var rect = sendBtn.getBoundingClientRect();
        return {
          success: true,
          ready: true,
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        };
      }
      return { success: true, ready: false, hasSendBtn: !!sendBtn };
    }
  `;
}

export function buildInjectScript(
  config: SiteHandlerConfig,
  findSendButtonNearInputBody: string,
  version: number,
  overrides?: InjectScriptOverrides
): string {
  const runtime = buildBrowserRuntime(config, findSendButtonNearInputBody);
  const inputType = json(config.inputType);
  const sendMethod = json(config.sendMethod);
  const sendButtonWaitMs = config.sendButtonWaitMs ?? 2000;

  const defaultFillInput = `
      function __fillInput(inputElement, content, configuredType) {
        var tag = inputElement.tagName;
        var effectiveType = tag === 'TEXTAREA' ? 'textarea'
          : tag === 'INPUT' ? 'input'
          : inputElement.isContentEditable ? 'contenteditable'
          : configuredType;
        inputElement.focus();

        if (effectiveType === 'textarea' || effectiveType === 'input') {
          var proto = effectiveType === 'textarea'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
          var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(inputElement, '');
            nativeSetter.call(inputElement, content);
          } else {
            inputElement.value = content;
          }
          try {
            inputElement.focus();
            inputElement.select();
            document.execCommand('insertText', false, content);
          } catch (e) {}
          inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: content }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        } else if (effectiveType === 'contenteditable') {
          try {
            inputElement.focus();
            var selection = window.getSelection();
            if (selection) {
              var range = document.createRange();
              range.selectNodeContents(inputElement);
              selection.removeAllRanges();
              selection.addRange(range);
            }
            document.execCommand('insertText', false, content);
          } catch (e) {
            inputElement.textContent = content;
          }
          inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: content }));
        }
      }`;

  const defaultSendAfterFill = `
          var sendMethod = ${sendMethod};
          if (sendMethod === 'click') {
            var sendButton = __findSendButton(inputElement);
            sendButton = await __waitForSendButtonReady(sendButton, inputElement, ${sendButtonWaitMs});
            if (sendButton) {
              __clickElement(sendButton);
            } else {
              __triggerEnter(inputElement);
            }
          } else if (sendMethod === 'enter') {
            __triggerEnter(inputElement);
          } else if (sendMethod === 'submit') {
            var form = inputElement.closest('form');
            if (form && typeof form.requestSubmit === 'function') form.requestSubmit();
            else if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            else __triggerEnter(inputElement);
          }`;

  const fillInputBlock = overrides?.fillInputFunction ?? defaultFillInput;
  const sendAfterFillBlock = overrides?.sendAfterFillBody ?? defaultSendAfterFill;
  const extraRuntime = overrides?.extraInjectRuntime ?? '';
  const referenceImageRuntime = config.referenceImage
    ? buildReferenceImageRuntime(config.referenceImage)
    : '';
  const hasReferenceImage = Boolean(config.referenceImage);

  const defaultInjectInput = `
      window.__injectInput__ = async function(payload) {
        try {
          var content = typeof payload === 'string' ? payload : (payload && payload.content) || '';
          var referenceImage = payload && typeof payload === 'object' ? payload.referenceImage : null;

          if (document.readyState !== 'complete') {
            await new Promise(function(resolve) {
              if (document.readyState === 'complete') resolve();
              else window.addEventListener('load', resolve, { once: true });
            });
          }
          await new Promise(function(r) { setTimeout(r, 500); });

          ${hasReferenceImage ? `
          if (referenceImage && referenceImage.dataUrl) {
            var uploadResult = await __uploadReferenceImage(referenceImage);
            if (!uploadResult.success) {
              return uploadResult;
            }
            await new Promise(function(r) { setTimeout(r, __REF_IMAGE_WAIT_MS__ || 800); });
          }
          ` : ''}

          if (!content.trim()) {
            return referenceImage ? { success: true, uploadOnly: true } : { success: false, error: '请输入提示词' };
          }

          var inputElement = null;
          for (var attempt = 0; attempt < 5; attempt++) {
            inputElement = __findInputElement();
            if (inputElement) break;
            await new Promise(function(r) { setTimeout(r, 500); });
          }
          if (!inputElement) {
            return { success: false, error: '未找到输入框，站点: ' + SITE_ID };
          }
          if (inputElement.disabled || inputElement.readOnly) {
            return { success: false, error: '输入框被禁用或只读' };
          }

          __fillInput(inputElement, content, ${inputType});
          await new Promise(function(r) { setTimeout(r, 300); });

          ${sendAfterFillBlock}

          return { success: true };
        } catch (error) {
          return { success: false, error: error.message || '未知错误' };
        }
      };`;

  const injectInputBlock = overrides?.injectInputFunction ?? defaultInjectInput;

  return `
    (function() {
      var HANDLER_VERSION = ${version};
      var SITE_ID = ${json(config.toolId)};
      if (window.__inputHandlerInjected__ && window.__inputHandlerVersion__ === HANDLER_VERSION && window.__inputHandlerSiteId__ === SITE_ID) {
        return { success: true, message: '脚本已存在' };
      }

      ${runtime}

      ${extraRuntime}

      function __clickElement(el) {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function(type) {
          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
      }

      function __triggerEnter(inputEl) {
        var opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        inputEl.dispatchEvent(new KeyboardEvent('keydown', opts));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, charCode: 13, bubbles: true, cancelable: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', opts));
        var form = inputEl.closest('form');
        if (form && typeof form.requestSubmit === 'function') {
          try { form.requestSubmit(); } catch (e) {}
        }
      }

      async function __waitForSendButtonReady(btn, inputEl, maxMs) {
        var start = Date.now();
        var current = btn;
        while (Date.now() - start < maxMs) {
          if (__isSendReady(current)) return current;
          await new Promise(function(r) { setTimeout(r, 100); });
          current = __findSendButton(inputEl) || current;
        }
        return __isSendReady(current) ? current : null;
      }

      ${fillInputBlock}

      ${referenceImageRuntime}

      ${injectInputBlock}

      window.__inputHandlerInjected__ = true;
      window.__inputHandlerVersion__ = HANDLER_VERSION;
      window.__inputHandlerSiteId__ = SITE_ID;
      return { success: true, message: '脚本注入成功', siteId: SITE_ID };
    })();
  `;
}

export function buildInjectCheckScript(toolId: string, version: number): string {
  return `
    (function() {
      return typeof window.__injectInput__ === 'function'
        && window.__inputHandlerInjected__ === true
        && window.__inputHandlerVersion__ === ${version}
        && window.__inputHandlerSiteId__ === ${json(toolId)};
    })();
  `;
}

export { sendButtonSelectorString };

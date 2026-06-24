import type { ConversationActionConfig, ConversationActionType, SiteHandlerConfig } from './types';

function json(value: unknown): string {
  return JSON.stringify(value);
}

export function buildConversationActionScript(
  config: SiteHandlerConfig,
  action: ConversationActionType
): string {
  const actionConfig: ConversationActionConfig | undefined =
    action === 'newChat' ? config.newChatAction : config.recentChatAction;
  const actionLabel = action === 'newChat' ? '新建对话' : '最近对话';

  if (!actionConfig) {
    return `(function(){ return { success: false, error: '该站点未配置${actionLabel}操作' }; })();`;
  }

  return `
    (function() {
      var cfg = ${json(actionConfig)};

      function isVisible(el) {
        if (!el) return false;
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (el.offsetParent === null && style.position !== 'fixed') return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function normalizeText(text) {
        return (text || '').replace(/\\s+/g, ' ').trim();
      }

      function shouldSkipText(text, skipList) {
        if (!text || !skipList || !skipList.length) return false;
        for (var i = 0; i < skipList.length; i++) {
          if (text.indexOf(skipList[i]) >= 0) return true;
        }
        return false;
      }

      function clickElement(el) {
        try {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          el.click();
          return true;
        } catch (e) {
          try {
            el.click();
            return true;
          } catch (e2) {
            return false;
          }
        }
      }

      function findBySelectors(selectors) {
        if (!selectors) return null;
        for (var i = 0; i < selectors.length; i++) {
          try {
            var nodes = document.querySelectorAll(selectors[i]);
            for (var j = 0; j < nodes.length; j++) {
              if (isVisible(nodes[j])) return nodes[j];
            }
          } catch (e) {}
        }
        return null;
      }

      function findByText(textIncludes) {
        if (!textIncludes || !textIncludes.length) return null;
        var candidates = document.querySelectorAll(
          'a, button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], li'
        );
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          if (!isVisible(el)) continue;
          var text = normalizeText(el.textContent);
          if (!text) continue;
          for (var j = 0; j < textIncludes.length; j++) {
            if (text === textIncludes[j] || text.indexOf(textIncludes[j]) >= 0) {
              return el;
            }
          }
        }
        return null;
      }

      function findInConversationList(listCfg) {
        if (!listCfg) return null;
        var containers = listCfg.containerSelectors || [];
        var itemSelectors = listCfg.itemSelectors || [];
        var skipList = listCfg.skipTextIncludes || [];
        var targetIndex = typeof listCfg.index === 'number' ? listCfg.index : 0;
        var visibleIndex = 0;

        for (var c = 0; c < containers.length; c++) {
          var container = document.querySelector(containers[c]);
          if (!container) continue;

          for (var s = 0; s < itemSelectors.length; s++) {
            var items = container.querySelectorAll(itemSelectors[s]);
            for (var i = 0; i < items.length; i++) {
              var item = items[i];
              if (!isVisible(item)) continue;
              var text = normalizeText(item.textContent);
              if (shouldSkipText(text, skipList)) continue;
              if (visibleIndex === targetIndex) return item;
              visibleIndex++;
            }
          }
        }
        return null;
      }

      if (cfg.url) {
        try {
          window.location.assign(cfg.url);
          return { success: true, method: 'url' };
        } catch (e) {
          return { success: false, error: '跳转失败: ' + (e && e.message ? e.message : String(e)) };
        }
      }

      var target =
        findBySelectors(cfg.selectors) ||
        findByText(cfg.textIncludes) ||
        findInConversationList(cfg.conversationList);

      if (!target) {
        return { success: false, error: '未找到${actionLabel}入口，请手动操作' };
      }

      if (!clickElement(target)) {
        return { success: false, error: '点击${actionLabel}入口失败' };
      }

      return { success: true, method: 'click' };
    })();
  `;
}

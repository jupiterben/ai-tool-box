import type { SiteHandlerConfig } from './types';

function json(value: unknown): string {
  return JSON.stringify(value);
}

export function buildExtractResponsesScript(config: SiteHandlerConfig): string {
  const responseSelectors = json(config.responseSelectors ?? []);
  const userSelectors = json(config.userMessageSelectors ?? []);
  const responseRootSelectors = json(config.responseRootSelectors ?? []);
  const responseIgnoreTexts = json(config.responseIgnoreTexts ?? []);

  return `
    (function() {
      function pickText(node) {
        if (!node) return '';
        return (node.innerText || node.textContent || '').trim();
      }

      function isIgnoredText(text, ignoreTexts) {
        if (!text) return true;
        var normalized = text.replace(/\\s+/g, ' ').trim();
        if (!normalized) return true;
        for (var i = 0; i < ignoreTexts.length; i++) {
          if (normalized === ignoreTexts[i]) return true;
        }
        return false;
      }

      function findSearchRoot(rootSelectors) {
        if (!rootSelectors || !rootSelectors.length) return document;
        for (var i = 0; i < rootSelectors.length; i++) {
          try {
            var root = document.querySelector(rootSelectors[i]);
            if (root) return root;
          } catch (e) {}
        }
        return document;
      }

      function extractBySelectors(selectors, root, ignoreTexts) {
        var searchRoot = root || document;
        for (var i = 0; i < selectors.length; i++) {
          try {
            var nodes = searchRoot.querySelectorAll(selectors[i]);
            for (var j = nodes.length - 1; j >= 0; j--) {
              var text = pickText(nodes[j]);
              if (text && !isIgnoredText(text, ignoreTexts)) {
                return { success: true, content: text, selector: selectors[i], count: nodes.length };
              }
            }
          } catch (e) {}
        }
        return { success: false, content: '', count: 0 };
      }

      function extractAllBySelectors(selectors, root, ignoreTexts) {
        var all = [];
        var searchRoot = root || document;
        for (var i = 0; i < selectors.length; i++) {
          try {
            var nodes = searchRoot.querySelectorAll(selectors[i]);
            for (var j = 0; j < nodes.length; j++) {
              var text = pickText(nodes[j]);
              if (text && !isIgnoredText(text, ignoreTexts)) all.push(text);
            }
            if (all.length) break;
          } catch (e) {}
        }
        return all;
      }

      var responseSelectors = ${responseSelectors};
      var userSelectors = ${userSelectors};
      var responseRootSelectors = ${responseRootSelectors};
      var responseIgnoreTexts = ${responseIgnoreTexts};
      var searchRoot = findSearchRoot(responseRootSelectors);

      if (!responseSelectors.length) {
        return { success: false, error: '未配置回复选择器', toolId: ${json(config.toolId)} };
      }

      var latest = extractBySelectors(responseSelectors, searchRoot, responseIgnoreTexts);
      var userLatest = userSelectors.length
        ? extractBySelectors(userSelectors, searchRoot, responseIgnoreTexts)
        : { success: false, content: '' };
      var allResponses = extractAllBySelectors(responseSelectors, searchRoot, responseIgnoreTexts);

      return {
        success: latest.success,
        toolId: ${json(config.toolId)},
        content: latest.content || '',
        userQuestion: userLatest.content || '',
        responseCount: allResponses.length,
        allResponses: allResponses,
        matchedSelector: latest.selector || '',
        error: latest.success ? undefined : '未找到 AI 回复内容',
      };
    })();
  `;
}

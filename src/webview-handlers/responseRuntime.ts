import type { SiteHandlerConfig } from './types';

function json(value: unknown): string {
  return JSON.stringify(value);
}

export function buildExtractResponsesScript(config: SiteHandlerConfig): string {
  const responseSelectors = json(config.responseSelectors ?? []);
  const userSelectors = json(config.userMessageSelectors ?? []);

  return `
    (function() {
      function pickText(node) {
        if (!node) return '';
        return (node.innerText || node.textContent || '').trim();
      }

      function extractBySelectors(selectors) {
        for (var i = 0; i < selectors.length; i++) {
          try {
            var nodes = document.querySelectorAll(selectors[i]);
            if (nodes.length) {
              var last = nodes[nodes.length - 1];
              var text = pickText(last);
              if (text) {
                return { success: true, content: text, selector: selectors[i], count: nodes.length };
              }
            }
          } catch (e) {}
        }
        return { success: false, content: '', count: 0 };
      }

      function extractAllBySelectors(selectors) {
        var all = [];
        for (var i = 0; i < selectors.length; i++) {
          try {
            var nodes = document.querySelectorAll(selectors[i]);
            for (var j = 0; j < nodes.length; j++) {
              var text = pickText(nodes[j]);
              if (text) all.push(text);
            }
            if (all.length) break;
          } catch (e) {}
        }
        return all;
      }

      var responseSelectors = ${responseSelectors};
      var userSelectors = ${userSelectors};

      if (!responseSelectors.length) {
        return { success: false, error: '未配置回复选择器', toolId: ${json(config.toolId)} };
      }

      var latest = extractBySelectors(responseSelectors);
      var userLatest = userSelectors.length ? extractBySelectors(userSelectors) : { success: false, content: '' };
      var allResponses = extractAllBySelectors(responseSelectors);

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

import type { SiteHandlerConfig } from './types';

function json(value: unknown): string {
  return JSON.stringify(value);
}

const DEFAULT_MIN_IMAGE_SIZE = 128;

function buildCollectImagesHelpers(
  imageSelectors: string,
  imageRootSelectors: string,
  minSize: number
): string {
  return `
      var imageSelectors = ${imageSelectors};
      var imageRootSelectors = ${imageRootSelectors};
      var minSize = ${minSize};

      function findSearchRoot() {
        if (!imageRootSelectors.length) return document;
        for (var i = 0; i < imageRootSelectors.length; i++) {
          try {
            var root = document.querySelector(imageRootSelectors[i]);
            if (root) return root;
          } catch (e) {}
        }
        return document;
      }

      function isLikelyGeneratedImage(img) {
        if (!img || !img.src) return false;
        var src = img.src;
        if (src.indexOf('favicon') >= 0) return false;
        if (src.indexOf('logo') >= 0 && (img.naturalWidth || img.width || 0) < minSize) return false;
        var w = img.naturalWidth || img.width || 0;
        var h = img.naturalHeight || img.height || 0;
        if (w > 0 && h > 0 && (w < minSize || h < minSize)) return false;
        return true;
      }

      function collectImages(searchRoot) {
        var seen = {};
        var results = [];
        var selectors = imageSelectors.length
          ? imageSelectors
          : ['img[src*="googleusercontent"]', 'img[src^="blob:"]', 'img[src^="data:image"]', 'main img[src]'];

        for (var i = 0; i < selectors.length; i++) {
          try {
            var nodes = searchRoot.querySelectorAll(selectors[i]);
            for (var j = 0; j < nodes.length; j++) {
              var img = nodes[j];
              if (!isLikelyGeneratedImage(img)) continue;
              var key = img.currentSrc || img.src;
              if (!key || seen[key]) continue;
              seen[key] = true;
              results.push({
                originSrc: key,
                width: img.naturalWidth || img.width || 0,
                height: img.naturalHeight || img.height || 0,
                alt: img.alt || '',
              });
            }
          } catch (e) {}
        }
        return results;
      }
  `;
}

/** 仅检测页面上的图片 originSrc，不做 base64 转换（轮询用） */
export function buildDetectImageOriginsScript(config: SiteHandlerConfig): string {
  const imageSelectors = json(config.imageResultSelectors ?? []);
  const imageRootSelectors = json(config.imageResultRootSelectors ?? []);
  const minSize = config.imageResultMinSize ?? DEFAULT_MIN_IMAGE_SIZE;

  return `
    (function() {
      ${buildCollectImagesHelpers(imageSelectors, imageRootSelectors, minSize)}
      var searchRoot = findSearchRoot();
      return collectImages(searchRoot);
    })();
  `;
}

/** 将指定 originSrc 的图片转为 base64 */
export function buildConvertImagesScript(config: SiteHandlerConfig, originSrcs: string[]): string {
  const imageSelectors = json(config.imageResultSelectors ?? []);
  const imageRootSelectors = json(config.imageResultRootSelectors ?? []);
  const minSize = config.imageResultMinSize ?? DEFAULT_MIN_IMAGE_SIZE;
  const targetsJson = json(originSrcs);

  return `
    (async function() {
      ${buildCollectImagesHelpers(imageSelectors, imageRootSelectors, minSize)}

      var targets = new Set(${targetsJson});
      var searchRoot = findSearchRoot();

      function waitForImageLoad(img, timeoutMs) {
        if (img.complete && (img.naturalWidth || img.width)) {
          return Promise.resolve();
        }
        return new Promise(function(resolve) {
          var done = false;
          var timer = setTimeout(function() {
            if (done) return;
            done = true;
            resolve();
          }, timeoutMs || 8000);
          img.onload = function() {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve();
          };
          img.onerror = function() {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve();
          };
        });
      }

      function parseDataUrl(dataUrl) {
        var match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
        if (!match) return null;
        return { mimeType: match[1], base64: match[2], dataUrl: dataUrl };
      }

      async function blobToDataUrl(blob) {
        return await new Promise(function(resolve, reject) {
          var reader = new FileReader();
          reader.onload = function() { resolve(String(reader.result || '')); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      async function resolveImageToDataUrl(img) {
        var originSrc = img.currentSrc || img.src || '';
        if (!originSrc) return null;
        if (originSrc.indexOf('data:image') === 0) {
          return { originSrc: originSrc, dataUrl: originSrc };
        }

        await waitForImageLoad(img, 10000);

        var w = img.naturalWidth || img.width || 0;
        var h = img.naturalHeight || img.height || 0;

        if (w > 0 && h > 0) {
          try {
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              var canvasDataUrl = canvas.toDataURL('image/png');
              if (canvasDataUrl && canvasDataUrl.indexOf('data:image') === 0) {
                return { originSrc: originSrc, dataUrl: canvasDataUrl };
              }
            }
          } catch (e) {}
        }

        try {
          var resp = await fetch(originSrc);
          var blob = await resp.blob();
          var fetchedDataUrl = await blobToDataUrl(blob);
          if (fetchedDataUrl && fetchedDataUrl.indexOf('data:image') === 0) {
            return { originSrc: originSrc, dataUrl: fetchedDataUrl };
          }
        } catch (e) {}

        return null;
      }

      function findImageByOrigin(originSrc) {
        var nodes = searchRoot.querySelectorAll('img');
        for (var n = 0; n < nodes.length; n++) {
          var node = nodes[n];
          if ((node.currentSrc || node.src) === originSrc) return node;
        }
        return null;
      }

      var collected = collectImages(searchRoot);
      var resolved = [];
      var convertAll = targets.size === 0;

      for (var k = 0; k < collected.length; k++) {
        var item = collected[k];
        if (!convertAll && !targets.has(item.originSrc)) continue;
        try {
          var imgNode = findImageByOrigin(item.originSrc);
          if (!imgNode) continue;
          var converted = await resolveImageToDataUrl(imgNode);
          if (!converted) continue;
          var parsed = parseDataUrl(converted.dataUrl);
          if (!parsed) continue;
          resolved.push({
            originSrc: converted.originSrc,
            base64: parsed.base64,
            mimeType: parsed.mimeType,
            dataUrl: parsed.dataUrl,
            width: item.width,
            height: item.height,
            alt: item.alt,
          });
        } catch (e) {}
      }

      return {
        success: resolved.length > 0,
        toolId: ${json(config.toolId)},
        images: resolved,
        error: resolved.length ? undefined : '图片 base64 转换失败',
      };
    })();
  `;
}

export function buildExtractImagesScript(config: SiteHandlerConfig): string {
  return buildConvertImagesScript(config, []);
}

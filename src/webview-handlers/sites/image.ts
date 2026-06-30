import { BaseSiteHandler } from '../BaseSiteHandler';
import type { ReferenceImageConfig, SiteHandlerConfig } from '../types';

const DEFAULT_IMAGE_PROMPT_SELECTORS = [
  'textarea[placeholder*="描述"]',
  'textarea[placeholder*="提示"]',
  'textarea[placeholder*="prompt" i]',
  'textarea[placeholder*="Prompt" i]',
  'textarea[placeholder*="想象"]',
  'textarea[placeholder*="创作"]',
  'textarea[placeholder*="输入"]',
  'textarea[data-testid*="prompt" i]',
  'input[placeholder*="描述"]',
  'input[placeholder*="prompt" i]',
  '[contenteditable="true"][role="textbox"]',
  'textarea',
  'input[type="text"]',
];

const DEFAULT_IMAGE_SEND_SELECTORS = [
  'button[type="submit"]',
  'button[aria-label*="生成"]',
  'button[aria-label*="Generate" i]',
  'button[aria-label*="Create" i]',
  '[data-testid*="generate" i]',
  '[data-testid*="submit" i]',
  'button[class*="generate" i]',
  'button[class*="submit" i]',
];

const DEFAULT_REFERENCE_IMAGE: ReferenceImageConfig = {
  inputSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  triggerSelectors: [
    '[aria-label*="上传"]',
    '[aria-label*="参考"]',
    '[aria-label*="Upload" i]',
    '[aria-label*="Reference" i]',
    'button[class*="upload" i]',
    '[class*="upload" i][role="button"]',
    '[data-testid*="upload" i]',
  ],
  waitAfterUploadMs: 800,
};

function createImageHandler(
  config: Pick<SiteHandlerConfig, 'toolId' | 'urlHint'> &
    Partial<Omit<SiteHandlerConfig, 'toolId' | 'urlHint'>>
): BaseSiteHandler {
  return new (class extends BaseSiteHandler {
    readonly config: SiteHandlerConfig = {
      inputSelectors: DEFAULT_IMAGE_PROMPT_SELECTORS,
      inputType: 'textarea',
      sendMethod: 'click',
      sendButtonSelectors: DEFAULT_IMAGE_SEND_SELECTORS,
      sendButtonWaitMs: 3000,
      referenceImage: DEFAULT_REFERENCE_IMAGE,
      ...config,
      toolId: config.toolId,
      urlHint: config.urlHint,
    };
  })();
}

export const jimengHandler = createImageHandler({
  toolId: 'jimeng',
  urlHint: 'jimeng.jianying.com',
  inputSelectors: [
    'textarea[placeholder*="描述"]',
    'textarea[placeholder*="输入"]',
    'textarea',
  ],
  referenceImage: {
    ...DEFAULT_REFERENCE_IMAGE,
    triggerSelectors: [
      '[aria-label*="参考"]',
      '[aria-label*="上传"]',
      'button[class*="upload" i]',
      ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!,
    ],
  },
});

export const wanxiangHandler = createImageHandler({
  toolId: 'wanxiang',
  urlHint: 'tongyi.aliyun.com',
  urlHints: ['tongyi.aliyun.com', 'wanxiang'],
  inputSelectors: [
    'textarea[placeholder*="描述"]',
    'textarea[placeholder*="输入"]',
    'textarea',
  ],
});

export const klingHandler = createImageHandler({
  toolId: 'kling',
  urlHint: 'klingai.com',
  inputSelectors: [
    'textarea[placeholder*="描述"]',
    'textarea[placeholder*="创意"]',
    'textarea',
  ],
});

export const liblibHandler = createImageHandler({
  toolId: 'liblib',
  urlHint: 'liblib.art',
  inputSelectors: [
    '#txt2img_prompt textarea',
    '#prompt textarea',
    'textarea[id*="prompt" i]',
    'textarea',
  ],
  sendButtonSelectors: ['#txt2img_generate', 'button#txt2img_generate', ...DEFAULT_IMAGE_SEND_SELECTORS],
  referenceImage: {
    inputSelectors: [
      '#img2img_image input[type="file"]',
      '#txt2img_image input[type="file"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
    ],
    triggerSelectors: ['#img2img_tab', '#img2img_visible_tab', ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!],
    waitAfterUploadMs: 1000,
  },
});

export const yigeHandler = createImageHandler({
  toolId: 'yige',
  urlHint: 'yige.baidu.com',
  inputSelectors: ['textarea[placeholder*="描述"]', 'textarea', 'input[type="text"]'],
});

export const miaohuaHandler = createImageHandler({
  toolId: 'miaohua',
  urlHint: 'miaohua.sensetime.com',
});

export const doubaoImageHandler = createImageHandler({
  toolId: 'doubao-image',
  urlHint: 'doubao.com',
  urlHints: ['doubao.com', 'www.doubao.com'],
  inputSelectors: [
    'textarea[data-testid="chat_input_input"]',
    'textarea[placeholder*="描述"]',
    'textarea[placeholder*="输入"]',
    'textarea',
  ],
  sendButtonSelectors: [
    '[data-testid="chat_input_send_button"]',
    'button[aria-label*="生成"]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
  sendMethod: 'enter',
  referenceImage: {
    ...DEFAULT_REFERENCE_IMAGE,
    triggerSelectors: [
      '[data-testid*="upload" i]',
      'button[aria-label*="上传"]',
      ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!,
    ],
  },
});

export const midjourneyHandler = createImageHandler({
  toolId: 'midjourney',
  urlHint: 'midjourney.com',
  inputSelectors: [
    'textarea[placeholder*="imagine" i]',
    'textarea[placeholder*="prompt" i]',
    'textarea',
  ],
  sendButtonSelectors: [
    'button[aria-label*="Create" i]',
    'button[aria-label*="Generate" i]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
});

export const leonardoHandler = createImageHandler({
  toolId: 'leonardo',
  urlHint: 'leonardo.ai',
  inputSelectors: ['textarea[placeholder*="prompt" i]', 'textarea', '[contenteditable="true"]'],
});

export const ideogramHandler = createImageHandler({
  toolId: 'ideogram',
  urlHint: 'ideogram.ai',
  inputSelectors: ['textarea[placeholder*="prompt" i]', 'textarea', '[contenteditable="true"]'],
});

export const fireflyHandler = createImageHandler({
  toolId: 'firefly',
  urlHint: 'firefly.adobe.com',
  inputSelectors: ['textarea[placeholder*="prompt" i]', 'textarea', '[contenteditable="true"]'],
});

export const bingCreateHandler = createImageHandler({
  toolId: 'bing-create',
  urlHint: 'bing.com',
  urlHints: ['bing.com', 'www.bing.com'],
  inputSelectors: [
    'textarea[name="q"]',
    'textarea[placeholder*="描述"]',
    'textarea',
    'input[name="q"]',
  ],
  sendButtonSelectors: [
    'button[aria-label*="创建"]',
    'button[aria-label*="Create" i]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
});

export const stabilityHandler = createImageHandler({
  toolId: 'stability',
  urlHint: 'stability.ai',
  inputSelectors: ['textarea[placeholder*="prompt" i]', 'textarea'],
});

export const recraftHandler = createImageHandler({
  toolId: 'recraft',
  urlHint: 'recraft.ai',
  inputSelectors: ['textarea[placeholder*="prompt" i]', 'textarea', '[contenteditable="true"]'],
});

export const IMAGE_HANDLERS: Record<string, BaseSiteHandler> = {
  jimeng: jimengHandler,
  wanxiang: wanxiangHandler,
  kling: klingHandler,
  liblib: liblibHandler,
  yige: yigeHandler,
  miaohua: miaohuaHandler,
  'doubao-image': doubaoImageHandler,
  midjourney: midjourneyHandler,
  leonardo: leonardoHandler,
  ideogram: ideogramHandler,
  firefly: fireflyHandler,
  'bing-create': bingCreateHandler,
  stability: stabilityHandler,
  recraft: recraftHandler,
};

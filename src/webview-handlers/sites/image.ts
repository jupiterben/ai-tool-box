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

const DEFAULT_IMAGE_RESULT_SELECTORS = [
  'img[src*="googleusercontent"]',
  'img[src^="blob:"]',
  'img[src^="data:image"]',
  '[class*="generated"] img',
  '[class*="result"] img',
  'main img[src]',
];

const DEFAULT_IMAGE_FAILURE_SELECTORS = [
  '[role="alert"]',
  '[aria-live]',
  '[data-testid*="error" i]',
  '[data-testid*="toast" i]',
  '[class*="error" i]',
  '[class*="toast" i]',
  '[class*="warning" i]',
  '[data-message-author-role="assistant"]',
  '.model-response-text',
  'message-content',
];

const DEFAULT_IMAGE_FAILURE_TEXTS = [
  '无法生成',
  '不能生成',
  '无法创建',
  '不能创建',
  '生成失败',
  '创建失败',
  '请求失败',
  '内容政策',
  '安全政策',
  '违反政策',
  '不符合政策',
  '敏感内容',
  'unable to generate',
  'cannot generate',
  "can't generate",
  'could not generate',
  "couldn't generate",
  'not able to generate',
  'failed to generate',
  'generation failed',
  'content policy',
  'safety policy',
  'violates',
  'violate',
  'disallowed',
  'unsafe',
  'blocked',
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
      imageResultSelectors: DEFAULT_IMAGE_RESULT_SELECTORS,
      imageResultMinSize: 128,
      imageFailureSelectors: DEFAULT_IMAGE_FAILURE_SELECTORS,
      imageFailureTexts: DEFAULT_IMAGE_FAILURE_TEXTS,
      ...config,
      toolId: config.toolId,
      urlHint: config.urlHint,
    };
  })();
}

export const jimengHandler = createImageHandler({
  toolId: 'jimeng',
  urlHint: 'jimeng.jianying.com',
  urlHints: ['jimeng.jianying.com/ai-tool/generate', 'jimeng.jianying.com'],
  newChatAction: {
    url: 'https://jimeng.jianying.com/ai-tool/generate/?type=image',
  },
  inputType: 'contenteditable',
  inputSelectors: [
    '.tiptap.ProseMirror[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"].ProseMirror',
    '[contenteditable="true"]',
    'textarea[placeholder*="描述"]',
    'textarea[placeholder*="输入"]',
    'textarea',
  ],
  sendButtonSelectors: [
    'button[class*="submit-button"]:not(.lv-btn-disabled)',
    'button[class*="submit-button"]',
    '.submit-button',
    'button[aria-label*="生成"]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
  nearInputSendSelectors: [
    'button[class*="submit-button"]:not(.lv-btn-disabled)',
    'button[class*="submit-button"]',
    '.submit-button',
  ],
  preferNearInputSendButton: true,
  sendDisabledClasses: ['lv-btn-disabled', 'ant-sender-actions-btn-disabled'],
  sendButtonWaitMs: 10_000,
  imageResultSelectors: [
    'img[src*="byteimg"]',
    'img[src*="jianying"]',
    'img[src*="jimeng"]',
    'img[src^="blob:"]',
    'img[src^="data:image"]',
    '[class*="image"] img',
    '[class*="result"] img',
    'main img[src]',
  ],
  imageResultRootSelectors: ['main', '[role="main"]', 'body'],
  imageResultMinSize: 256,
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
    '.tiptap.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"]',
    'textarea',
  ],
  sendButtonSelectors: [
    '[data-testid="chat_input_send_button"]',
    'button[aria-label*="生成"]',
    '.send-btn-wrapper button',
    '.send-btn-wrapper',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
  sendMethod: 'enter',
  imageResultSelectors: [
    'img[src*="rc_gen_image"]',
    'img[src*="rc_gen_image" i]',
  ],
  imageResultRootSelectors: ['main', '[role="main"]', 'body'],
  imageResultMinSize: 256,
  referenceImage: {
    ...DEFAULT_REFERENCE_IMAGE,
    triggerSelectors: [
      '[data-testid*="upload" i]',
      'button[aria-label*="上传"]',
      ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!,
    ],
  },
});

export const geminiImageHandler = createImageHandler({
  toolId: 'gemini-image',
  urlHint: 'gemini.google.com',
  urlHints: ['gemini.google.com/images'],
  newChatAction: {
    url: 'https://gemini.google.com/images',
  },
  inputRootSelectors: ['main', '[role="main"]', 'body'],
  imageResultSelectors: [
    'img[src*="googleusercontent"]',
    'img[src*="ggpht"]',
    'img[src^="blob:"]',
    'img[src^="data:image"]',
    '[data-testid*="image"] img',
    'main img[src]',
  ],
  imageResultRootSelectors: ['main', '[role="main"]', 'body'],
  inputType: 'contenteditable',
  inputSelectors: [
    'div.ql-editor[contenteditable="true"]',
    '.ql-editor[contenteditable="true"]',
    'rich-textarea [contenteditable="true"]',
    'rich-textarea textarea',
    'div[contenteditable="true"][aria-label*="prompt" i]',
    'div[contenteditable="true"][aria-label*="Describe" i]',
    'div[role="textbox"][contenteditable="true"]',
    'textarea[aria-label*="Describe" i]',
    'textarea[aria-label*="Enter" i]',
    'div[contenteditable="true"]',
    ...DEFAULT_IMAGE_PROMPT_SELECTORS,
  ],
  sendButtonSelectors: [
    'button[aria-label*="Send" i]',
    '[role="button"][aria-label*="Send" i]',
    'button[aria-label*="Create" i]',
    'button[aria-label*="Generate" i]',
    'button[aria-label*="Submit" i]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
  nearInputSendSelectors: [
    'button[aria-label*="Send" i]',
    '[role="button"][aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button[type="submit"]',
    '[data-testid*="send" i]',
    '[data-testid*="submit" i]',
  ],
  preferNearInputSendButton: true,
  sendButtonWaitMs: 10_000,
  referenceImage: {
    ...DEFAULT_REFERENCE_IMAGE,
    triggerSelectors: [
      'button[aria-label*="Upload" i]',
      'button[aria-label*="Add" i]',
      'button[aria-label*="Attach" i]',
      'button[aria-label*="Image" i]',
      '[aria-label*="upload" i]',
      '[data-testid*="upload" i]',
      ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!,
    ],
    waitAfterUploadMs: 1200,
  },
});

export const aistudioImageHandler = createImageHandler({
  toolId: 'aistudio-image',
  urlHint: 'aistudio.google.com',
  urlHints: [
    'aistudio.google.com/prompts/new_chat',
    'aistudio.google.com/prompts/new_image',
    'aistudio.google.com',
  ],
  newChatAction: {
    url: 'https://aistudio.google.com/prompts/new_chat?model=gemini-2.5-flash-image',
  },
  inputRootSelectors: ['main', '[role="main"]', 'body'],
  inputType: 'textarea',
  inputSelectors: [
    'textarea[aria-label*="prompt" i]',
    'textarea[placeholder*="prompt" i]',
    'textarea[placeholder*="Describe" i]',
    'textarea[placeholder*="Enter a prompt" i]',
    'textarea[placeholder*="Start typing" i]',
    'textarea[aria-label*="Type something" i]',
    'div[contenteditable="true"][aria-label*="prompt" i]',
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"]',
    'textarea',
    ...DEFAULT_IMAGE_PROMPT_SELECTORS,
  ],
  sendButtonSelectors: [
    'button[aria-label*="Run" i]',
    'button[aria-label="Run"]',
    'run-button button',
    'button[aria-label*="Generate" i]',
    'button[aria-label*="Create" i]',
    'button[aria-label*="Send" i]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
  nearInputSendSelectors: [
    'button[aria-label*="Run" i]',
    'button[aria-label="Run"]',
    'run-button button',
    'button[aria-label*="Generate" i]',
    'button[type="submit"]',
  ],
  preferNearInputSendButton: true,
  sendButtonWaitMs: 10_000,
  imageResultSelectors: [
    'img[src*="googleusercontent"]',
    'img[src*="ggpht"]',
    'img[src*="generativelanguage"]',
    'img[src^="blob:"]',
    'img[src^="data:image"]',
    '[data-testid*="image"] img',
    'model-response img[src]',
    'main img[src]',
  ],
  imageResultRootSelectors: ['main', '[role="main"]', 'body'],
  imageResultMinSize: 128,
  referenceImage: {
    ...DEFAULT_REFERENCE_IMAGE,
    triggerSelectors: [
      'button[aria-label*="Upload" i]',
      'button[aria-label*="Add" i]',
      'button[aria-label*="Attach" i]',
      'button[aria-label*="Image" i]',
      ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!,
    ],
    waitAfterUploadMs: 1200,
  },
});

export const chatgptImageHandler = createImageHandler({
  toolId: 'chatgpt-image',
  urlHint: 'chatgpt.com',
  urlHints: ['chatgpt.com/images', 'chatgpt.com', 'oaidalleapiprodscus.blob.core.windows.net'],
  newChatAction: {
    url: 'https://chatgpt.com/images',
  },
  inputRootSelectors: ['main', '[role="main"]', 'body'],
  inputType: 'contenteditable',
  inputSelectors: [
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][id="prompt-textarea"]',
    'div[contenteditable="true"][role="textbox"]',
    'div.ProseMirror[contenteditable="true"]',
    'textarea[placeholder*="Message" i]',
    'textarea',
    ...DEFAULT_IMAGE_PROMPT_SELECTORS,
  ],
  sendButtonSelectors: [
    '[data-testid="send-button"]',
    'button[data-testid*="send" i]',
    'button[aria-label*="Send" i]',
    'button[type="submit"]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
  nearInputSendSelectors: [
    '[data-testid="send-button"]',
    'button[data-testid*="send" i]',
    'button[aria-label*="Send" i]',
    'button[type="submit"]',
  ],
  preferNearInputSendButton: true,
  sendButtonWaitMs: 10_000,
  imageResultSelectors: [
    'img[src*="oaidalleapiprodscus"]',
    'img[src*="dalle"]',
    'img[src*="openai"]',
    'img[src^="blob:"]',
    'img[src^="data:image"]',
    '[data-testid*="image"] img',
    '[data-message-author-role="assistant"] img[src]',
    'main img[src]',
  ],
  imageResultRootSelectors: ['main', '[role="main"]', 'body'],
  imageResultMinSize: 256,
  referenceImage: {
    ...DEFAULT_REFERENCE_IMAGE,
    triggerSelectors: [
      '[data-testid*="upload" i]',
      '[data-testid*="attach" i]',
      'button[aria-label*="Upload" i]',
      'button[aria-label*="Attach" i]',
      'button[aria-label*="Add" i]',
      ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!,
    ],
    waitAfterUploadMs: 1200,
  },
});

export const grokImageHandler = createImageHandler({
  toolId: 'grok-image',
  urlHint: 'grok.com',
  urlHints: ['grok.com/imagine', 'grok.com'],
  newChatAction: {
    url: 'https://grok.com/imagine',
  },
  inputRootSelectors: ['main', '[role="main"]', 'body'],
  inputType: 'contenteditable',
  inputSelectors: [
    "textarea[data-testid='grok-input']",
    '[contenteditable="true"][data-testid*="input" i]',
    '[contenteditable="true"][aria-label*="prompt" i]',
    '[contenteditable="true"][aria-label*="imagine" i]',
    '[contenteditable="true"][aria-label*="Ask" i]',
    '[contenteditable="true"][aria-label*="message" i]',
    'div[role="textbox"][contenteditable="true"]',
    'textarea[placeholder*="imagine" i]',
    'textarea[placeholder*="prompt" i]',
    'textarea[placeholder*="Ask" i]',
    'textarea',
    ...DEFAULT_IMAGE_PROMPT_SELECTORS,
  ],
  sendButtonSelectors: [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Generate" i]',
    'button[aria-label*="Create" i]',
    'button[type="submit"]',
    ...DEFAULT_IMAGE_SEND_SELECTORS,
  ],
  nearInputSendSelectors: [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Generate" i]',
    'button[aria-label*="Create" i]',
    'button[type="submit"]',
  ],
  preferNearInputSendButton: true,
  sendButtonWaitMs: 10_000,
  imageResultSelectors: [
    'img[src*="grok"]',
    'img[src*="x.ai"]',
    'img[src^="blob:"]',
    'img[src^="data:image"]',
    '[data-testid*="image"] img',
    '[class*="image"] img',
    '[class*="result"] img',
    'main img[src]',
  ],
  imageResultRootSelectors: ['main', '[role="main"]', 'body'],
  imageResultMinSize: 256,
  imageFailureSelectors: [
    '[role="alert"]',
    '[aria-live]',
    '[data-testid*="error" i]',
    '[data-testid*="toast" i]',
    '[class*="error" i]',
    '[class*="toast" i]',
    '[class*="warning" i]',
    '[data-testid*="message" i]',
    ...DEFAULT_IMAGE_FAILURE_SELECTORS,
  ],
  imageFailureTexts: [
    ...DEFAULT_IMAGE_FAILURE_TEXTS,
    'cannot create',
    "can't create",
    'could not create',
    "couldn't create",
    'failed to create',
    'image generation failed',
  ],
  referenceImage: {
    ...DEFAULT_REFERENCE_IMAGE,
    triggerSelectors: [
      '[data-testid*="upload" i]',
      '[data-testid*="attach" i]',
      'button[aria-label*="Upload" i]',
      'button[aria-label*="Attach" i]',
      'button[aria-label*="Add" i]',
      ...DEFAULT_REFERENCE_IMAGE.triggerSelectors!,
    ],
    waitAfterUploadMs: 1200,
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
  'gemini-image': geminiImageHandler,
  'aistudio-image': aistudioImageHandler,
  'chatgpt-image': chatgptImageHandler,
  'grok-image': grokImageHandler,
  midjourney: midjourneyHandler,
  leonardo: leonardoHandler,
  ideogram: ideogramHandler,
  firefly: fireflyHandler,
  stability: stabilityHandler,
  recraft: recraftHandler,
};

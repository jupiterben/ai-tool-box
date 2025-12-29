import { WebviewInputSelector } from '../types/webview-input-selector';

export interface WebviewInputHandlerConfig {
  toolId: string;
  webviewElement: HTMLElement & { executeJavaScript?: (code: string) => Promise<any>; getWebContents?: () => any };
  inputContent: string;
  selectors: WebviewInputSelector;
  timeout?: number;
}

export interface WebviewInputHandlerResult {
  success: boolean;
  error?: string;
}

/**
 * 获取 webview 的 executeJavaScript 方法
 * Electron webview 需要通过 getWebContents() 获取 webContents 来执行 JavaScript
 */
function getExecuteJavaScript(webview: any): ((code: string) => Promise<any>) | null {
  // 方法1: 直接调用 webview.executeJavaScript (如果存在)
  if (typeof webview.executeJavaScript === 'function') {
    return webview.executeJavaScript.bind(webview);
  }
  
  // 方法2: 通过 getWebContents() 获取 webContents
  if (typeof webview.getWebContents === 'function') {
    try {
      const webContents = webview.getWebContents();
      if (webContents && typeof webContents.executeJavaScript === 'function') {
        return webContents.executeJavaScript.bind(webContents);
      }
    } catch (error) {
      console.error('[WebviewInputHandler] 获取 webContents 失败:', error);
    }
  }
  
  // 方法3: 尝试访问 webview.webContents
  if (webview.webContents && typeof webview.webContents.executeJavaScript === 'function') {
    return webview.webContents.executeJavaScript.bind(webview.webContents);
  }
  
  return null;
}

/**
 * 注入输入处理脚本到 webview
 * 这个脚本会创建一个全局函数供后续调用
 */
async function injectInputScript(
  selectors: WebviewInputSelector,
  executeJavaScript: (code: string) => Promise<any>,
  timeout: number = 5000
): Promise<WebviewInputHandlerResult> {
  const selectorsJson = JSON.stringify(selectors.selectors);
  const inputTypeJson = JSON.stringify(selectors.inputType);
  const sendMethodJson = JSON.stringify(selectors.sendMethod);
  const sendButtonSelectorJson = JSON.stringify(selectors.sendButtonSelector || '');

  const injectCode = `
    (function() {
      // 如果已经注入过，直接返回
      if (window.__inputHandlerInjected__) {
        return { success: true, message: '脚本已存在' };
      }
      
      // 创建输入处理函数
      window.__injectInput__ = async function(content) {
        try {
          // 等待 DOM 完全加载
          if (document.readyState !== 'complete') {
            await new Promise(resolve => {
              if (document.readyState === 'complete') {
                resolve();
              } else {
                window.addEventListener('load', resolve, { once: true });
              }
            });
          }
          
          // 额外等待，确保动态内容加载完成
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 尝试多个选择器
          let inputElement = null;
          const selectors = ${selectorsJson};
          
          // 尝试查找输入框，最多重试5次
          for (let attempt = 0; attempt < 5; attempt++) {
            for (const selector of selectors) {
              try {
                inputElement = document.querySelector(selector);
                if (inputElement && inputElement.offsetParent !== null && !inputElement.disabled && !inputElement.readOnly) {
                  break;
                }
                inputElement = null;
              } catch (e) {
                console.error('选择器错误:', selector, e);
              }
            }
            
            if (inputElement) {
              break;
            }
            
            // 等待一下再重试
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          if (!inputElement) {
            return { success: false, error: '未找到输入框元素，尝试的选择器: ' + ${selectorsJson}.join(', ') };
          }
          
          // 确保元素可见且可编辑
          if (inputElement.disabled || inputElement.readOnly) {
            return { success: false, error: '输入框被禁用或只读' };
          }
          
          // 根据输入框类型填充内容
          const inputType = ${inputTypeJson};
          
          if (inputType === 'textarea' || inputType === 'input') {
            // 清空现有内容
            inputElement.value = '';
            // 设置新内容
            inputElement.value = content;
            // 触发多个事件以确保页面响应
            inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            // 对于 React 等框架，可能需要触发这些事件
            inputElement.dispatchEvent(new Event('keydown', { bubbles: true }));
            inputElement.dispatchEvent(new Event('keyup', { bubbles: true }));
            // 触发 React 的合成事件
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            nativeInputValueSetter.call(inputElement, content);
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (inputType === 'contenteditable') {
            inputElement.textContent = content;
            inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          }
          
          // 聚焦输入框
          inputElement.focus();
          
          // 等待一下，确保内容已填充
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 触发发送
          const sendMethod = ${sendMethodJson};
          if (sendMethod === 'click' && ${sendButtonSelectorJson}) {
            const sendButton = document.querySelector(${sendButtonSelectorJson});
            if (sendButton && !sendButton.disabled) {
              sendButton.click();
            } else {
              // 如果没有找到发送按钮，触发 Enter 键
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              });
              inputElement.dispatchEvent(enterEvent);
              inputElement.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                bubbles: true,
              }));
            }
          } else if (sendMethod === 'enter') {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            });
            inputElement.dispatchEvent(enterEvent);
            inputElement.dispatchEvent(new KeyboardEvent('keyup', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              bubbles: true,
            }));
          } else if (sendMethod === 'submit') {
            const form = inputElement.closest('form');
            if (form) {
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          }
          
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message || '未知错误' };
        }
      };
      
      // 标记脚本已注入
      window.__inputHandlerInjected__ = true;
      
      return { success: true, message: '脚本注入成功' };
    })();
  `;

  try {
    const executePromise = executeJavaScript(injectCode);
    const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: '注入脚本超时' }), timeout)
    );

    const result = await Promise.race([executePromise, timeoutPromise]);
    
    if (result && typeof result === 'object' && 'success' in result) {
      return result as WebviewInputHandlerResult;
    }

    return {
      success: false,
      error: '注入脚本失败',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '注入脚本失败',
    };
  }
}

/**
 * 检查脚本是否已注入
 */
async function checkScriptInjected(executeJavaScript: (code: string) => Promise<any>): Promise<boolean> {
  try {
    const checkCode = `
      (function() {
        return typeof window.__injectInput__ === 'function' && window.__inputHandlerInjected__ === true;
      })();
    `;
    
    const result = await executeJavaScript(checkCode);
    return result === true;
  } catch {
    return false;
  }
}

/**
 * Webview 输入处理器
 * 通过延迟注入的 JavaScript 脚本将输入内容传递到 webview
 */
export async function handleWebviewInput(
  config: WebviewInputHandlerConfig
): Promise<WebviewInputHandlerResult> {
  const { webviewElement, inputContent, selectors, timeout = 5000 } = config;

  // 获取 webview 的 executeJavaScript 方法
  const webview = webviewElement as any;
  const executeJavaScript = getExecuteJavaScript(webview);
  
  if (!executeJavaScript) {
    console.error(`[WebviewInputHandler] ${config.toolId} 无法获取 executeJavaScript 方法`, {
      hasExecuteJavaScript: typeof webview.executeJavaScript === 'function',
      hasGetWebContents: typeof webview.getWebContents === 'function',
      hasWebContents: !!webview.webContents,
    });
    return {
      success: false,
      error: 'Webview 不支持 JavaScript 注入',
    };
  }

  // 等待 webview 加载完成
  const waitForLoad = async (): Promise<void> => {
    // 首先检查是否已经加载完成
    if (webview.isLoading === false) {
      console.log(`[WebviewInputHandler] ${config.toolId} webview 已经加载完成`);
      return;
    }

    // 尝试通过 executeJavaScript 检查页面是否已加载
    try {
      const checkCode = `
        (function() {
          return document.readyState === 'complete' || document.readyState === 'interactive';
        })();
      `;
      const isReady = await executeJavaScript(checkCode);
      if (isReady === true) {
        console.log(`[WebviewInputHandler] ${config.toolId} 页面已就绪`);
        return;
      }
    } catch (error) {
      console.log(`[WebviewInputHandler] ${config.toolId} 无法检查页面状态，继续等待事件`);
    }

    // 如果还没加载完成，等待 did-finish-load 事件
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (webview.removeEventListener) {
          webview.removeEventListener('did-finish-load', onLoad);
        }
        // 超时后再次检查，如果页面已就绪则继续
        executeJavaScript(`
          (function() {
            return document.readyState === 'complete' || document.readyState === 'interactive';
          })();
        `).then((isReady) => {
          if (isReady === true) {
            console.log(`[WebviewInputHandler] ${config.toolId} 超时后检查发现页面已就绪`);
            resolve();
          } else {
            reject(new Error('Webview 加载超时'));
          }
        }).catch(() => {
          reject(new Error('Webview 加载超时'));
        });
      }, Math.max(timeout, 10000)); // 至少等待10秒

      const onLoad = () => {
        clearTimeout(timeoutId);
        if (webview.removeEventListener) {
          webview.removeEventListener('did-finish-load', onLoad);
        }
        resolve();
      };

      // 监听 did-finish-load 事件
      if (webview.addEventListener) {
        webview.addEventListener('did-finish-load', onLoad);
      } else {
        // 如果无法监听事件，直接 resolve（可能已经加载完成）
        clearTimeout(timeoutId);
        resolve();
      }
    });
  };

  try {
    console.log(`[WebviewInputHandler] 开始处理 ${config.toolId} 的输入传递`);
    
    // 先检查脚本是否已注入（如果已注入，说明页面已经加载完成）
    let isInjected = false;
    try {
      isInjected = await checkScriptInjected(executeJavaScript);
      console.log(`[WebviewInputHandler] ${config.toolId} 脚本注入状态:`, isInjected);
    } catch (error) {
      console.log(`[WebviewInputHandler] ${config.toolId} 检查脚本注入失败，可能需要等待加载:`, error);
    }
    
    // 如果脚本未注入，等待 webview 加载完成
    if (!isInjected) {
      try {
        await waitForLoad();
        console.log(`[WebviewInputHandler] ${config.toolId} webview 加载完成`);
      } catch (error) {
        console.warn(`[WebviewInputHandler] ${config.toolId} 等待加载超时，但继续尝试执行:`, error);
        // 即使超时也继续尝试，因为页面可能已经加载完成
      }
      
      // 额外等待一小段时间，确保页面完全渲染
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`[WebviewInputHandler] ${config.toolId} 页面渲染等待完成`);
      
      // 再次检查脚本是否已注入（可能在等待期间已注入）
      try {
        isInjected = await checkScriptInjected(executeJavaScript);
        console.log(`[WebviewInputHandler] ${config.toolId} 等待后脚本注入状态:`, isInjected);
      } catch (error) {
        console.log(`[WebviewInputHandler] ${config.toolId} 等待后检查脚本注入失败:`, error);
      }
    }

    // 如果没有注入，则注入脚本
    if (!isInjected) {
      console.log(`[WebviewInputHandler] ${config.toolId} 开始注入脚本`);
      const injectResult = await injectInputScript(selectors, executeJavaScript, timeout);
      
      if (!injectResult.success) {
        console.error(`[WebviewInputHandler] ${config.toolId} 脚本注入失败:`, injectResult.error);
        return injectResult;
      }
      
      console.log(`[WebviewInputHandler] ${config.toolId} 脚本注入成功`);
    }

    // 调用已注入的函数传递输入内容
    const contentJson = JSON.stringify(inputContent);
    const callCode = `
      (async function() {
        if (typeof window.__injectInput__ === 'function') {
          const content = ${contentJson};
          return await window.__injectInput__(content);
        } else {
          return { success: false, error: '输入处理函数未找到，请重新注入脚本' };
        }
      })();
    `;

    console.log(`[WebviewInputHandler] ${config.toolId} 调用输入处理函数`);
    const executePromise = executeJavaScript(callCode);
    const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: '操作超时' }), 5000)
    );

    const result = await Promise.race([executePromise, timeoutPromise]);
    console.log(`[WebviewInputHandler] ${config.toolId} 执行结果:`, result);

    if (result && typeof result === 'object' && 'success' in result) {
      return result as WebviewInputHandlerResult;
    }

    console.error(`[WebviewInputHandler] ${config.toolId} 返回了意外的结果:`, result);
    return {
      success: false,
      error: '未知错误',
    };
  } catch (error) {
    console.error(`[WebviewInputHandler] ${config.toolId} 执行失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '执行失败',
    };
  }
}

/**
 * 在 webview 加载完成后预先注入脚本
 */
export async function preInjectScript(
  webviewElement: HTMLElement & { executeJavaScript?: (code: string) => Promise<any>; getWebContents?: () => any },
  selectors: WebviewInputSelector,
  timeout: number = 5000
): Promise<WebviewInputHandlerResult> {
  const webview = webviewElement as any;
  const executeJavaScript = getExecuteJavaScript(webview);
  
  if (!executeJavaScript) {
    return {
      success: false,
      error: 'Webview 不支持 JavaScript 注入',
    };
  }

  // 等待 webview 加载完成
  const waitForLoad = async (): Promise<void> => {
    // 首先检查是否已经加载完成
    if (webview.isLoading === false) {
      return;
    }

    // 尝试通过 executeJavaScript 检查页面是否已加载
    try {
      const checkCode = `
        (function() {
          return document.readyState === 'complete' || document.readyState === 'interactive';
        })();
      `;
      const isReady = await executeJavaScript(checkCode);
      if (isReady === true) {
        return;
      }
    } catch (error) {
      // 如果无法检查，继续等待事件
    }

    // 如果还没加载完成，等待 did-finish-load 事件
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (webview.removeEventListener) {
          webview.removeEventListener('did-finish-load', onLoad);
        }
        // 超时后再次检查
        executeJavaScript(`
          (function() {
            return document.readyState === 'complete' || document.readyState === 'interactive';
          })();
        `).then((isReady) => {
          if (isReady === true) {
            resolve();
          } else {
            reject(new Error('Webview 加载超时'));
          }
        }).catch(() => {
          reject(new Error('Webview 加载超时'));
        });
      }, Math.max(timeout, 10000));

      const onLoad = () => {
        clearTimeout(timeoutId);
        if (webview.removeEventListener) {
          webview.removeEventListener('did-finish-load', onLoad);
        }
        resolve();
      };

      if (webview.addEventListener) {
        webview.addEventListener('did-finish-load', onLoad);
      } else {
        clearTimeout(timeoutId);
        resolve();
      }
    });
  };

  try {
    try {
      await waitForLoad();
    } catch (error) {
      console.warn(`[WebviewInputHandler] 预注入等待加载超时，但继续尝试:`, error);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 检查是否已注入
    const isInjected = await checkScriptInjected(executeJavaScript);
    if (isInjected) {
      return { success: true };
    }

    // 注入脚本
    return await injectInputScript(selectors, executeJavaScript, timeout);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '预注入脚本失败',
    };
  }
}

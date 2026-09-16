require('../../dist-electron/preload.cjs');
localStorage.setItem('ai-tool-box-selected-tools', JSON.stringify(['deepseek', 'qianwen']));
localStorage.setItem('ai-tool-box-selected-image-tools', JSON.stringify(['jimeng']));
localStorage.setItem(
  'ai-tool-box-selected-tools-dev',
  JSON.stringify(['deepseek', 'qianwen']),
);
localStorage.setItem(
  'ai-tool-box-selected-image-tools-dev',
  JSON.stringify(['jimeng']),
);

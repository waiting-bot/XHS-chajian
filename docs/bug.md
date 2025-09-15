// ===== 步骤1：修复配置保存和存储读取问题 =====
// 修改 popup/popup.ts 添加配置检查和错误处理
@@ -src/popup/popup.ts
// 在采集按钮点击事件处理函数开头添加
document.getElementById('collectButton').addEventListener('click', async () => {
  // 检查配置是否存在
  const config = await chrome.storage.sync.get([
    'feishuAppToken', 
    'feishuPersonalBaseToken',
    'feishuTableId'
  ]);
  
  if (!config.feishuAppToken || !config.feishuPersonalBaseToken) {
    // 显示友好提示并引导到配置页
    showConfigError('请先完成飞书配置');
    return;
  }
  
  // 原有采集逻辑...
});

// 添加错误提示函数
function showConfigError(message: string) {
  const errorEl = document.createElement('div');
  errorEl.className = 'config-error';
  errorEl.innerHTML = `
    <p>${message}</p>
    <button id="goToConfig">前往配置</button>
  `;
  document.body.appendChild(errorEl);
  
  document.getElementById('goToConfig').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// 修改 background/background.ts 添加上传前的配置检查
@@ -src/background/background.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'uploadToFeishu') {
    // 检查配置
    chrome.storage.sync.get(['feishuAppToken'], (result) => {
      if (!result.feishuAppToken) {
        console.error('缺少飞书配置');
        // 发送错误通知到popup
        chrome.runtime.sendMessage({
          type: 'configError',
          message: '配置信息不完整'
        });
        return;
      }
      // 原有上传逻辑...
    });
    return true;
  }
});

// ===== 步骤2：创建专业的Options Page配置页面 =====
// 创建options目录和文件
+++ src/options/options.html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>小红书采集器配置</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    .container { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .toast { position: fixed; top: 1rem; right: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>飞书配置</h1>
    
    <form id="configForm">
      <label for="appToken">
        多维表格 App Token
        <input type="text" id="appToken" name="appToken" required 
          placeholder="从飞书表格URL获取">
      </label>
      
      <label for="personalToken">
        个人访问令牌
        <input type="password" id="personalToken" name="personalToken" required
          placeholder="从飞书开放平台获取">
      </label>
      
      <label for="tableId">
        表格 ID
        <input type="text" id="tableId" name="tableId" required
          placeholder="table=后面的内容">
      </label>
      
      <button type="submit" id="saveBtn">保存配置</button>
    </form>
    
    <div id="toast" class="toast hide"></div>
  </div>
  
  <script src="./options.ts" type="module"></script>
</body>
</html>

+++ src/options/options.ts
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('configForm') as HTMLFormElement;
  const toast = document.getElementById('toast') as HTMLDivElement;
  
  // 加载保存的配置
  chrome.storage.sync.get([
    'feishuAppToken', 
    'feishuPersonalBaseToken',
    'feishuTableId'
  ], (config) => {
    (document.getElementById('appToken') as HTMLInputElement).value = 
      config.feishuAppToken || '';
    (document.getElementById('personalToken') as HTMLInputElement).value = 
      config.feishuPersonalBaseToken || '';
    (document.getElementById('tableId') as HTMLInputElement).value = 
      config.feishuTableId || '';
  });
  
  // 表单提交处理
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const appToken = (document.getElementById('appToken') as HTMLInputElement).value;
    const personalToken = (document.getElementById('personalToken') as HTMLInputElement).value;
    const tableId = (document.getElementById('tableId') as HTMLInputElement).value;
    
    // 保存配置
    chrome.storage.sync.set({
      feishuAppToken: appToken,
      feishuPersonalBaseToken: personalToken,
      feishuTableId: tableId
    }, () => {
      showToast('配置保存成功!', 'success');
    });
  });
  
  // 显示提示消息
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
      toast.className = 'toast hide';
    }, 3000);
  }
});

// 修改manifest.json添加options_ui配置
@@ -src/manifest.json
{
  "options_ui": {
    "page": "src/options/options.html",
    "open_in_tab": true
  }
}

// ===== 步骤3：美化Popup界面 =====
// 修改popup.html引入Pico CSS
@@ -src/popup/popup.html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    .container { padding: 1rem; text-align: center; min-width: 300px; }
    .status { margin: 1rem 0; padding: 0.5rem; }
    .success { background: #d4edda; }
    .error { background: #f8d7da; }
  </style>
</head>
<body>
  <div class="container">
    <h3>小红书采集器</h3>
    
    <div id="pageStatus" class="status">
      正在检测小红书笔记页面...
    </div>
    
    <button id="collectButton" class="primary">采集当前笔记</button>
    <button id="openOptions">配置插件</button>
  </div>
</body>

// 添加页面状态检测逻辑到popup.ts
@@ -src/popup/popup.ts
// 在DOMContentLoaded事件中添加
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('pageStatus') as HTMLDivElement;
  
  // 检查当前标签页是否为小红书笔记
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.url.includes('xiaohongshu.com/discovery/item/')) {
    statusEl.textContent = '已检测到小红书笔记页面';
    statusEl.className = 'status success';
    document.getElementById('collectButton').disabled = false;
  } else {
    statusEl.textContent = '未检测到小红书笔记页面';
    statusEl.className = 'status error';
    document.getElementById('collectButton').disabled = true;
  }
  
  // 打开配置页按钮
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// ===== 步骤4：增强笔记页面检测 =====
// 修改manifest.json扩展匹配规则
@@ -src/manifest.json
"content_scripts": [
  {
    "matches": [
      "https://www.xiaohongshu.com/discovery/item/*",
      "https://www.xiaohongshu.com/explore/*",
      "https://www.xiaohongshu.com/user/profile/*/post/*"
    ],
    "js": ["src/content/content.ts"]
  }
]

// 加强content.ts中的页面检测逻辑
@@ -src/content/content.ts
// 检测是否在笔记页面
function isNotePage() {
  // URL模式匹配
  const noteUrlPatterns = [
    /https:\/\/www\.xiaohongshu\.com\/discovery\/item\/[a-z0-9]+/i,
    /https:\/\/www\.xiaohongshu\.com\/explore\/[a-z0-9]+/i,
    /https:\/\/www\.xiaohongshu\.com\/user\/profile\/[a-z0-9]+\/post\/[a-z0-9]+/i
  ];
  
  // 页面元素检测
  const hasNoteContent = !!document.querySelector('.note-container');
  const hasNoteImages = !!document.querySelector('.swiper-wrapper');
  
  return noteUrlPatterns.some(pattern => pattern.test(location.href)) 
    && hasNoteContent 
    && hasNoteImages;
}

// 当收到采集消息时
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'collectNote') {
    if (!isNotePage()) {
      // 发送错误状态到popup
      chrome.runtime.sendMessage({
        type: 'pageError',
        message: '当前页面不是小红书笔记'
      });
      return;
    }
    
    // 执行采集逻辑...
  }
});

// ===== 步骤5：最终优化和测试 =====
// 更新package.json中的脚本
@@ -package.json
"scripts": {
  "dev": "vite build --watch --mode development",
  "build": "vite build --mode production",
  "preview": "vite preview",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "format": "prettier --write .",
  "test": "vitest run"
}

// 创建测试页面
+++ test/test.html
<!DOCTYPE html>
<html>
<head>
  <title>小红书笔记测试</title>
  <style>
    .note-container { padding: 20px; }
    .swiper-wrapper { display: flex; gap: 10px; }
    .swiper-slide { width: 100px; height: 100px; background: #eee; }
  </style>
</head>
<body>
  <div class="note-container">
    <h1>测试笔记标题</h1>
    <p>这是测试笔记内容...</p>
    <div class="swiper-wrapper"
    >
      <div class="swiper-slide"></div>
      <div class="swiper-slide"></div>
    </div>
  </div>
  
  <script>
    // 模拟笔记页面URL
    history.replaceState({}, '', '/discovery/item/test123');
  </script>
</body>
</html>

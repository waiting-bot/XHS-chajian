// ===== 修复飞书数据写入问题 =====
// 1. 增强飞书API调用
@@ -src/lib/feishu-api.ts
async function writeToFeishu(data: NoteData, config: FeishuConfig) {
  try {
    // 验证配置有效性
    if (!isValidConfig(config)) {
      throw new Error('无效的飞书配置');
    }
    
    // 构建请求数据
    const payload = {
      fields: {
        [config.columnMapping.title]: data.title,
        [config.columnMapping.author]: data.author,
        // 其他字段映射...
      }
    };
    
    // 添加调试日志
    console.debug('飞书写入请求:', payload);
    
    // 发送请求
    const response = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    // 验证响应
    if (!response.ok || result.code !== 0) {
      throw new Error(`飞书API错误: ${result.msg || '未知错误'}`);
    }
    
    return result.data;
  } catch (error) {
    console.error('飞书写入失败:', error);
    throw error;
  }
}

// 2. 添加验证工具
@@ -src/lib/feishu-api.ts
function isValidConfig(config: FeishuConfig): boolean {
  return !!(
    config.appToken &&
    config.accessToken &&
    config.tableId &&
    config.columnMapping.title
  );
}

// ===== 修复配置选择器问题 =====
// 1. 确保配置数据加载
@@ -src/popup/popup.ts
async function loadConfigurations() {
  try {
    // 从存储加载配置
    const configs = await chrome.storage.sync.get('feishuConfigs');
    
    if (!configs.feishuConfigs || configs.feishuConfigs.length === 0) {
      console.warn('没有找到配置');
      return [];
    }
    
    // 验证并解析配置
    return parseConfigs(configs.feishuConfigs);
  } catch (error) {
    console.error('配置加载失败:', error);
    return [];
  }
}

function parseConfigs(configData: any): FeishuConfig[] {
  try {
    // 安全解析JSON
    const parsed = JSON.parse(configData);
    
    // 验证是否为数组
    if (!Array.isArray(parsed)) {
      throw new Error('配置格式错误: 不是数组');
    }
    
    return parsed;
  } catch (error) {
    console.error('配置解析失败:', error);
    return [];
  }
}

// 2. 刷新配置选择器
@@ -src/popup/popup.ts
function refreshConfigSelector(configs: FeishuConfig[]) {
  const selector = document.getElementById('config-selector');
  if (!selector) return;
  
  // 清空现有选项
  selector.innerHTML = '';
  
  // 添加默认选项
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- 请选择配置 --';
  selector.appendChild(defaultOption);
  
  // 添加配置选项
  configs.forEach(config => {
    const option = document.createElement('option');
    option.value = config.id;
    option.textContent = config.name;
    selector.appendChild(option);
  });
}

// 3. 在初始化时加载配置
@@ -src/popup/popup.ts
document.addEventListener('DOMContentLoaded', async () => {
  // 加载配置
  const configs = await loadConfigurations();
  
  // 刷新选择器
  refreshConfigSelector(configs);
  
  // 其他初始化...
});

// ===== 实现界面固定与关闭控制 =====
// 1. 将Popup改为独立页面
// 修改manifest配置
@@ -src/manifest.json
{
  "action": {
    "default_popup": "popup.html"
    // 改为使用独立页面
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true // 在标签页中打开
  }
}

// 创建独立选项页面
+++ src/options.html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>小红书采集器配置</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="options-container">
    <h1>飞书配置管理</h1>
    <!-- 配置表单内容 -->
    <button id="close-options">关闭配置</button>
  </div>
  <script src="options.js"></script>
</body>
</html>

// 2. 添加关闭按钮逻辑
@@ -src/options.js
document.getElementById('close-options').addEventListener('click', () => {
  // 关闭当前标签页
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) chrome.tabs.remove(tabs[0].id);
  });
});

// 3. 更新Popup中的配置入口
@@ -src/popup/popup.html
<button id="open-config">
  <span>配置管理</span>
</button>

// 添加打开配置事件
@@ -src/popup/popup.ts
document.getElementById('open-config').addEventListener('click', () => {
  // 打开独立配置页面
  chrome.runtime.openOptionsPage();
});

// ===== 添加终极调试功能 =====
// 1. 在飞书API中添加响应日志
@@ -src/lib/feishu-api.ts
console.log('飞书API响应:', {
  status: response.status,
  data: result
});

// 2. 添加存储检查工具
@@ -src/popup/popup.ts
// 添加调试按钮
<button id="debug-storage">检查存储</button>

// 添加调试功能
document.getElementById('debug-storage').addEventListener('click', async () => {
  const configs = await chrome.storage.sync.get('feishuConfigs');
  console.log('当前存储的配置:', configs.feishuConfigs);
  
  alert(`存储中配置数量: ${configs.feishuConfigs ? JSON.parse(configs.feishuConfigs).length : 0}`);
});

// 3. 添加飞书API测试工具
@@ -src/options.js
// 添加测试按钮
<button id="test-feishu-api">测试飞书API</button>

// 添加测试功能
document.getElementById('test-feishu-api').addEventListener('click', async () => {
  try {
    // 获取当前配置
    const config = getCurrentConfig();
    
    // 创建测试数据
    const testData = {
      title: '测试标题',
      author: '测试作者',
      content: '这是测试内容',
      timestamp: Date.now()
    };
    
    // 写入飞书
    const result = await writeToFeishu(testData, config);
    
    alert(`测试成功! 记录ID: ${result.record_id}`);
  } catch (error) {
    alert(`测试失败: ${error.message}`);
  }
});
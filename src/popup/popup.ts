import './popup.css'

// 添加配置状态类型
type ConfigStatus = {
  isConfigured: boolean
  lastUpdated?: string
  error?: string
  details?: {
    hasAppId: boolean
    hasAppSecret: boolean
    hasAppToken: boolean
    hasTableId: boolean
  }
}

// 更新配置状态函数
async function updateConfigStatus(): Promise<ConfigStatus> {
  try {
    return new Promise((resolve) => {
      chrome.storage.sync.get([
        'feishuAppToken', 
        'feishuAppSecret',
        'feishuAppId',
        'feishuTableId'
      ], (result) => {
        // 检查所有必需的配置项
        const hasAppId = !!result.feishuAppId;
        const hasAppSecret = !!result.feishuAppSecret;
        const hasAppToken = !!result.feishuAppToken;
        const hasTableId = !!result.feishuTableId;
        const isConfigured = hasAppId && hasAppSecret && hasAppToken && hasTableId;
        
        console.log('配置状态检查:', {
          hasAppId,
          hasAppSecret, 
          hasAppToken,
          hasTableId,
          isConfigured
        });
        
        resolve({
          isConfigured,
          lastUpdated: new Date().toLocaleTimeString(),
          details: {
            hasAppId,
            hasAppSecret,
            hasAppToken,
            hasTableId
          }
        });
      });
    });
  } catch (error) {
    console.error('获取配置状态失败:', error);
    return {
      isConfigured: false,
      error: error.message,
      lastUpdated: new Date().toLocaleTimeString()
    };
  }
}

// 渲染配置状态到UI
function renderConfigStatus(status: ConfigStatus) {
  const statusEl = document.getElementById('configStatus');
  if (!statusEl) return;
  
  statusEl.innerHTML = '';
  
  const statusIcon = document.createElement('span');
  statusIcon.className = status.isConfigured ? 'status-icon success' : 'status-icon error';
  statusIcon.textContent = status.isConfigured ? '✓' : '✗';
  
  const statusText = document.createElement('span');
  statusText.className = 'status-text';
  statusText.textContent = status.isConfigured 
    ? '配置完整' 
    : '配置缺失或错误';
  
  const timeText = document.createElement('small');
  timeText.className = 'status-time';
  timeText.textContent = status.lastUpdated ? `更新于: ${status.lastUpdated}` : '';
  
  statusEl.appendChild(statusIcon);
  statusEl.appendChild(statusText);
  statusEl.appendChild(timeText);
  
  // 添加调试信息（仅在开发模式下显示）
  if (status.details) {
    const debugInfo = document.createElement('div');
    debugInfo.className = 'debug-info';
    debugInfo.innerHTML = `
      <small>调试信息:<br>
      App ID: ${status.details.hasAppId ? '有' : '无'}<br>
      App Secret: ${status.details.hasAppSecret ? '有' : '无'}<br>
      App Token: ${status.details.hasAppToken ? '有' : '无'}<br>
      Table ID: ${status.details.hasTableId ? '有' : '无'}
      </small>
    `;
    statusEl.appendChild(debugInfo);
  }
  
  if (status.error) {
    const errorText = document.createElement('div');
    errorText.className = 'status-error';
    errorText.textContent = `错误: ${status.error}`;
    statusEl.appendChild(errorText);
  }
}

// 初始化popup
document.addEventListener('DOMContentLoaded', async () => {
  let retryCount = 0;
  const maxRetries = 3;
  
  const loadConfigWithRetry = async () => {
    try {
      console.log(`尝试加载配置 (${retryCount + 1}/${maxRetries})`);
      const initialStatus = await updateConfigStatus();
      renderConfigStatus(initialStatus);
      
      // 如果配置不完整且还有重试次数，稍后重试
      if (!initialStatus.isConfigured && retryCount < maxRetries) {
        retryCount++;
        console.log(`配置不完整，${retryCount}秒后重试...`);
        setTimeout(loadConfigWithRetry, 1000);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(loadConfigWithRetry, 1000);
      }
    }
  };
  
  // 初始加载
  loadConfigWithRetry();
  
  // 添加刷新按钮事件
  const refreshBtn = document.getElementById('refreshConfig')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = '刷新中...'

      try {
        const newStatus = await updateConfigStatus()
        renderConfigStatus(newStatus)
      } catch (error) {
        console.error('刷新配置失败:', error)
      } finally {
        setTimeout(() => {
          refreshBtn.textContent = '刷新状态'
        }, 1000)
      }
    })
  }

  // 添加配置按钮事件
  const configBtn = document.getElementById('openOptions')
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage()
    })
  }

  // 监听存储变化
  chrome.storage.onChanged.addListener(async (changes) => {
    // 检查是否有配置项变化
    const configKeys = ['feishuAppToken', 'feishuAppSecret', 'feishuAppId', 'feishuTableId']
    const hasConfigChange = configKeys.some(key => key in changes)

    if (hasConfigChange) {
      console.log('检测到配置变化，更新状态...');
      const newStatus = await updateConfigStatus()
      renderConfigStatus(newStatus)

      // 显示更新通知
      const notice = document.createElement('div')
      notice.className = 'update-notice'
      notice.textContent = '配置已更新!'
      document.body.appendChild(notice)

      setTimeout(() => {
        notice.remove()
      }, 2000)
    }
  })

  // 添加消息监听器（用于接收来自options页面的配置更新通知）
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'configUpdated') {
      console.log('收到配置更新消息:', message.data);
      // 配置已更新，立即刷新状态
      updateConfigStatus().then((newStatus) => {
        renderConfigStatus(newStatus);
        
        // 显示更新通知
        const notice = document.createElement('div');
        notice.className = 'update-notice';
        notice.textContent = '配置已更新!';
        document.body.appendChild(notice);
        
        setTimeout(() => {
          notice.remove();
        }, 2000);
      });
    }
  });
})
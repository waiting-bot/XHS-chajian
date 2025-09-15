import './popup.css'

// 添加配置状态类型
type ConfigStatus = {
  isConfigured: boolean
  lastUpdated?: string
  error?: string
}

// 更新配置状态函数
async function updateConfigStatus(): Promise<ConfigStatus> {
  try {
    const config = await chrome.storage.sync.get([
      'feishuAppToken',
      'feishuPersonalBaseToken',
      'feishuTableId'
    ])

    const isConfigured = !!(
      config.feishuAppToken &&
      config.feishuPersonalBaseToken &&
      config.feishuTableId
    )

    return {
      isConfigured,
      lastUpdated: new Date().toLocaleTimeString()
    }
  } catch (error) {
    console.error('获取配置状态失败:', error)
    return {
      isConfigured: false,
      error: error.message
    }
  }
}

// 渲染配置状态到UI
function renderConfigStatus(status: ConfigStatus) {
  const statusEl = document.getElementById('configStatus')
  if (!statusEl) return

  statusEl.innerHTML = ''

  const statusIcon = document.createElement('span')
  statusIcon.className = status.isConfigured ? 'status-icon success' : 'status-icon error'
  statusIcon.textContent = status.isConfigured ? '✓' : '✗'

  const statusText = document.createElement('span')
  statusText.className = 'status-text'
  statusText.textContent = status.isConfigured ? '配置完整' : '配置缺失或错误'

  const timeText = document.createElement('small')
  timeText.className = 'status-time'
  timeText.textContent = status.lastUpdated ? `更新于: ${status.lastUpdated}` : ''

  if (status.error) {
    const errorText = document.createElement('div')
    errorText.className = 'status-error'
    errorText.textContent = `错误: ${status.error}`
    statusEl.appendChild(errorText)
  }

  statusEl.appendChild(statusIcon)
  statusEl.appendChild(statusText)
  statusEl.appendChild(timeText)
}

// 初始化popup
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 初始加载状态
  const initialStatus = await updateConfigStatus()
  renderConfigStatus(initialStatus)

  // 2. 添加刷新按钮事件
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

  // 3. 添加配置按钮事件
  const configBtn = document.getElementById('openOptions')
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage()
    })
  }

  // 4. 监听存储变化
  chrome.storage.onChanged.addListener(async (changes) => {
    // 检查是否有配置项变化
    const configKeys = ['feishuAppToken', 'feishuPersonalBaseToken', 'feishuTableId']
    const hasConfigChange = configKeys.some(key => key in changes)

    if (hasConfigChange) {
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
})
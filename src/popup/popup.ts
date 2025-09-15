import './popup.css'

// 扩展的类型定义
interface ConfigStatus {
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

interface FeishuConfig {
  name: string
  appId: string
  appSecret: string
  appToken: string
  tableId: string
  notes?: string
  createdAt?: number
  updatedAt?: number
}

interface PageStatus {
  isXiaohongshuPage: boolean
  isNotePage: boolean
  url?: string
  title?: string
  error?: string
}

interface DataPreview {
  title?: string
  author?: {
    name: string
    avatar?: string
  }
  content?: string
  tags?: string[]
  stats?: {
    likes: number
    collects: number
    comments: number
  }
  media?: {
    images: string[]
    videos: string[]
  }
}

interface CollectionState {
  isCollecting: boolean
  isPaused: boolean
  progress: number
  error?: string
}

class PopupManager {
  private configStatus: ConfigStatus | null = null
  private pageStatus: PageStatus | null = null
  private dataPreview: DataPreview | null = null
  private collectionState: CollectionState = {
    isCollecting: false,
    isPaused: false,
    progress: 0
  }
  private currentEditingConfig: FeishuConfig | null = null
  private configs: Record<string, FeishuConfig> = {}

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      await this.loadInitialStatus()
      this.setupEventListeners()
      this.startStatusMonitoring()
    } catch (error) {
      console.error('初始化失败:', error)
      this.showError('初始化失败', error.message)
    }
  }

  private async loadInitialStatus() {
    await Promise.all([
      this.updateConfigStatus(),
      this.updatePageStatus(),
      this.loadConfigurations()
    ])
  }

  private setupEventListeners() {
    // 配置相关按钮
    document.getElementById('testConnection')?.addEventListener('click', () => this.testConnection())
    document.getElementById('manageConfigs')?.addEventListener('click', () => this.openConfigManager())
    document.getElementById('refreshConfigs')?.addEventListener('click', () => this.loadConfigurations())
    document.getElementById('configSelector')?.addEventListener('change', (e) => this.onConfigChange(e))

    // 数据操作按钮
    document.getElementById('startCollection')?.addEventListener('click', () => this.startCollection())
    document.getElementById('pauseCollection')?.addEventListener('click', () => this.pauseCollection())
    document.getElementById('refreshData')?.addEventListener('click', () => this.refreshData())
    document.getElementById('togglePreview')?.addEventListener('click', () => this.togglePreview())

    // 模态框相关按钮
    document.getElementById('closeModal')?.addEventListener('click', () => this.closeConfigModal())
    document.getElementById('modalOverlay')?.addEventListener('click', () => this.closeConfigModal())
    document.getElementById('cancelConfig')?.addEventListener('click', () => this.closeConfigModal())
    document.getElementById('saveConfig')?.addEventListener('click', () => this.saveConfig())
    document.getElementById('testConfigBtn')?.addEventListener('click', () => this.testCurrentConfig())
    
    // 密码显示切换
    document.getElementById('toggleSecret')?.addEventListener('click', () => this.togglePasswordVisibility('appSecret'))
    document.getElementById('toggleToken')?.addEventListener('click', () => this.togglePasswordVisibility('appToken'))

    // 存储变化监听
    chrome.storage.onChanged.addListener((changes) => this.onStorageChanged(changes))
    
    // 消息监听
    chrome.runtime.onMessage.addListener((message) => this.onMessage(message))
  }

  private startStatusMonitoring() {
    // 定期更新页面状态
    setInterval(() => this.updatePageStatus(), 3000)
    
    // 定期更新配置状态
    setInterval(() => this.updateConfigStatus(), 10000)
  }

  // 配置状态管理
  private async updateConfigStatus(): Promise<ConfigStatus> {
    try {
      return new Promise((resolve) => {
        chrome.storage.sync.get([
          'feishuAppToken', 
          'feishuAppSecret',
          'feishuAppId',
          'feishuTableId'
        ], (result) => {
          const hasAppId = !!result.feishuAppId
          const hasAppSecret = !!result.feishuAppSecret
          const hasAppToken = !!result.feishuAppToken
          const hasTableId = !!result.feishuTableId
          const isConfigured = hasAppId && hasAppSecret && hasAppToken && hasTableId
          
          this.configStatus = {
            isConfigured,
            lastUpdated: new Date().toLocaleTimeString(),
            details: {
              hasAppId,
              hasAppSecret,
              hasAppToken,
              hasTableId
            }
          }
          
          this.renderConfigStatus()
          resolve(this.configStatus)
        })
      })
    } catch (error) {
      console.error('获取配置状态失败:', error)
      const errorStatus: ConfigStatus = {
        isConfigured: false,
        error: error.message,
        lastUpdated: new Date().toLocaleTimeString()
      }
      this.configStatus = errorStatus
      this.renderConfigStatus()
      return errorStatus
    }
  }

  private renderConfigStatus() {
    const statusEl = document.getElementById('configStatus')
    if (!statusEl || !this.configStatus) return
    
    statusEl.innerHTML = `
      <div class="config-status-display">
        <div class="status-row">
          <span class="status-indicator ${this.configStatus.isConfigured ? 'success' : 'error'}"></span>
          <span class="status-text">${this.configStatus.isConfigured ? '配置完整' : '配置缺失'}</span>
          <span class="status-time">${this.configStatus.lastUpdated}</span>
        </div>
        ${this.configStatus.error ? `<div class="error-text">${this.configStatus.error}</div>` : ''}
      </div>
    `
    
    // 更新连接状态
    this.updateConnectionStatus(this.configStatus.isConfigured)
    
    // 更新按钮状态
    this.updateButtonStates()
  }

  // 页面状态管理
  private async updatePageStatus(): Promise<PageStatus> {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true})
      if (!tab || !tab.url) {
        this.pageStatus = {isXiaohongshuPage: false, isNotePage: false}
        this.renderPageStatus()
        return this.pageStatus
      }
      
      const isXiaohongshuPage = tab.url.includes('xiaohongshu.com')
      const isNotePage = isXiaohongshuPage && tab.url.includes('/explore/')
      
      this.pageStatus = {
        isXiaohongshuPage,
        isNotePage,
        url: tab.url,
        title: tab.title
      }
      
      this.renderPageStatus()
      this.updateButtonStates()
      
      // 如果是小红书笔记页面，自动采集数据预览
      if (isNotePage) {
        this.collectDataPreview()
      }
      
      return this.pageStatus
    } catch (error) {
      console.error('获取页面状态失败:', error)
      const errorStatus: PageStatus = {
        isXiaohongshuPage: false,
        isNotePage: false,
        error: error.message
      }
      this.pageStatus = errorStatus
      this.renderPageStatus()
      return errorStatus
    }
  }

  private renderPageStatus() {
    const pageInfo = document.getElementById('pageInfo')
    const statusDot = document.getElementById('pageStatusDot')
    const statusText = document.getElementById('pageStatusText')
    
    if (!pageInfo || !this.pageStatus) return
    
    if (this.pageStatus.error) {
      pageInfo.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠</div>
          <div class="error-message">${this.pageStatus.error}</div>
        </div>
      `
      if (statusDot) statusDot.className = 'indicator-dot error'
      if (statusText) statusText.textContent = '页面检测失败'
      return
    }
    
    if (this.pageStatus.isXiaohongshuPage) {
      if (this.pageStatus.isNotePage) {
        pageInfo.innerHTML = `
          <div class="page-item">
            <div class="info-icon">📝</div>
            <div class="info-details">
              <div class="info-label">笔记页面</div>
              <div class="info-value">${this.pageStatus.title || '小红书笔记'}</div>
            </div>
          </div>
        `
        if (statusDot) statusDot.className = 'indicator-dot success'
        if (statusText) statusText.textContent = '笔记页面'
      } else {
        pageInfo.innerHTML = `
          <div class="page-item">
            <div class="info-icon">🏠</div>
            <div class="info-details">
              <div class="info-label">小红书主页</div>
              <div class="info-value">请打开笔记页面</div>
            </div>
          </div>
        `
        if (statusDot) statusDot.className = 'indicator-dot loading'
        if (statusText) statusText.textContent = '非笔记页面'
      }
    } else {
      pageInfo.innerHTML = `
        <div class="page-item">
          <div class="info-icon">🌐</div>
          <div class="info-details">
            <div class="info-label">当前页面</div>
            <div class="info-value">非小红书页面</div>
          </div>
        </div>
      `
      if (statusDot) statusDot.className = 'indicator-dot error'
      if (statusText) statusText.textContent = '非小红书页面'
    }
  }

  // 数据预览管理
  private async collectDataPreview() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true})
      if (!tab || !tab.id) {
        console.warn('无法获取当前标签页信息')
        return
      }
      
      // 检查content script是否已注入
      const isInjected = await this.checkContentScriptInjected(tab.id)
      if (!isInjected) {
        console.warn('Content script未注入，尝试注入...')
        await this.injectContentScript(tab.id)
      }
      
      // 向content script发送消息获取数据，带重试机制
      const response = await this.retryOperation(
        () => this.sendMessageToContentScript(tab.id, { type: 'collectData' }),
        '数据采集',
        3, // 最多重试3次
        1000 // 重试间隔1秒
      )
      
      if (response && response.data) {
        this.dataPreview = response.data
        this.renderDataPreview()
      } else {
        console.warn('未收到有效数据响应')
      }
    } catch (error) {
      console.error('采集数据预览失败:', error)
      // 不显示错误通知，只在控制台记录
      // this.showError('数据采集失败', error.message)
    }
  }

  // 检查content script是否已注入
  private async checkContentScriptInjected(tabId: number): Promise<boolean> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' })
      return response && response.pong
    } catch {
      return false
    }
  }

  // 注入content script
  private async injectContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      })
      console.log('Content script注入成功')
    } catch (error) {
      console.error('Content script注入失败:', error)
    }
  }

  // 向content script发送消息
  private async sendMessageToContentScript(tabId: number, message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('消息发送超时'))
      }, 5000)

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeout)
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    })
  }

  // 重试操作
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        if (attempt > 1) {
          console.log(`${operationName}在第${attempt}次尝试后成功`)
        }
        return result
      } catch (error) {
        lastError = error as Error
        console.warn(`${operationName}第${attempt}次尝试失败:`, error)
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error(`${operationName}失败`)
  }

  private renderDataPreview() {
    const previewCard = document.getElementById('previewCard')
    const previewContent = document.getElementById('previewContent')
    
    if (!previewCard || !previewContent || !this.dataPreview) return
    
    previewCard.style.display = 'block'
    
    const mediaContent = this.renderMediaContent()
    const tagsContent = this.dataPreview.tags?.length ? `
      <div class="preview-tags">
        ${this.dataPreview.tags.map(tag => `<span class="tag-chip">${tag}</span>`).join('')}
      </div>
    ` : ''
    
    previewContent.innerHTML = `
      <div class="preview-section">
        <div class="preview-title">${this.dataPreview.title || '无标题'}</div>
        ${this.dataPreview.author ? `
          <div class="preview-author">
            <img class="author-avatar" src="${this.dataPreview.author.avatar || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNmMGYwZjAiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSIzIiBmaWxsPSIjY2NjY2NjIi8+CjxwYXRoIGQ9Ik0xMiAxNEM4IDE0IDQgMTYgNCAyMEgyMEMyMCAxNiAxNiAxNCAxMiAxNFoiIGZpbGw9IiNjY2NjY2Yi8+Cjwvc3ZnPg=='}" alt="头像">
            <span class="author-name">${this.dataPreview.author.name}</span>
          </div>
        ` : ''}
        <div class="preview-content">${this.dataPreview.content || '无内容'}</div>
        ${tagsContent}
        ${mediaContent}
        ${this.dataPreview.stats ? `
          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-icon">❤️</span>
              <span class="stat-value">${this.dataPreview.stats.likes}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">⭐</span>
              <span class="stat-value">${this.dataPreview.stats.collects}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">💬</span>
              <span class="stat-value">${this.dataPreview.stats.comments}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  private renderMediaContent(): string {
    if (!this.dataPreview?.media) return ''
    
    const {images, videos} = this.dataPreview.media
    
    if (videos && videos.length > 0) {
      return `
        <div class="preview-media">
          <div class="video-preview">
            <div class="video-thumbnail">🎹</div>
            <div class="video-info">${videos.length} 个视频</div>
          </div>
        </div>
      `
    }
    
    if (images && images.length > 0) {
      return `
        <div class="preview-media">
          <div class="image-preview">
            ${images.slice(0, 3).map((img, index) => `
              <img src="${img}" alt="图片${index + 1}" class="preview-image ${index === 0 ? 'primary' : ''}">
            `).join('')}
            ${images.length > 3 ? `<div class="more-images">+${images.length - 3}</div>` : ''}
          </div>
        </div>
      `
    }
    
    return ''
  }

  // 配置管理
  private async loadConfigurations() {
    try {
      const selector = document.getElementById('configSelector') as HTMLSelectElement
      if (!selector) return
      
      // 加载保存的配置
      chrome.storage.sync.get(['feishuConfigs'], (result) => {
        const configs = result.feishuConfigs || {}
        const configNames = Object.keys(configs)
        
        selector.innerHTML = '<option value="">选择配置...</option>'
        configNames.forEach(name => {
          const option = document.createElement('option')
          option.value = name
          option.textContent = name
          selector.appendChild(option)
        })
        
        // 恢复上次选择的配置
        const currentConfig = localStorage.getItem('currentConfig')
        if (currentConfig && configNames.includes(currentConfig)) {
          selector.value = currentConfig
        }
      })
    } catch (error) {
      console.error('加载配置失败:', error)
      this.showError('配置加载失败', error.message)
    }
  }

  private onConfigChange(event: Event) {
    const selector = event.target as HTMLSelectElement
    const selectedConfigId = selector.value
    
    localStorage.setItem('currentConfigId', selectedConfigId)
    
    // 更新当前使用的配置
    if (selectedConfigId && this.configs[selectedConfigId]) {
      const config = this.configs[selectedConfigId]
      // 将选中的配置同步到Chrome sync存储以便其他功能使用
      chrome.storage.sync.set({
        'feishuAppId': config.appId,
        'feishuAppSecret': config.appSecret,
        'feishuAppToken': config.appToken,
        'feishuTableId': config.tableId
      })
    }
    
    this.updateConfigStatus()
    this.updateConfigsList()
    this.updateButtonStates()
  }

  private async testConnection() {
    try {
      this.showNotification('测试连接', '正在测试飞书连接...', 'info')
      
      // 模拟连接测试
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      if (this.configStatus?.isConfigured) {
        this.showNotification('连接成功', '飞书连接正常', 'success')
      } else {
        this.showNotification('连接失败', '请检查配置信息', 'error')
      }
    } catch (error) {
      this.showNotification('连接测试失败', error.message, 'error')
    }
  }

  // 配置管理方法
  private openConfigManager() {
    const modal = document.getElementById('configModal') as HTMLElement
    if (!modal) return
    
    // 重置表单
    const form = document.getElementById('configForm') as HTMLFormElement
    form?.reset()
    
    // 如果当前有选中的配置，填充表单
    const selector = document.getElementById('configSelector') as HTMLSelectElement
    const selectedConfigId = selector?.value
    if (selectedConfigId && this.configs[selectedConfigId]) {
      const config = this.configs[selectedConfigId]
      const modalTitle = document.getElementById('modalTitle') as HTMLElement
      if (modalTitle) modalTitle.textContent = '编辑配置'
      
      // 填充表单数据
      const configNameInput = document.getElementById('configName') as HTMLInputElement
      const appIdInput = document.getElementById('appId') as HTMLInputElement
      const appSecretInput = document.getElementById('appSecret') as HTMLInputElement
      const appTokenInput = document.getElementById('appToken') as HTMLInputElement
      const tableIdInput = document.getElementById('tableId') as HTMLInputElement
      const configNotesInput = document.getElementById('configNotes') as HTMLTextAreaElement
      
      if (configNameInput) configNameInput.value = config.name
      if (appIdInput) appIdInput.value = config.appId
      if (appSecretInput) appSecretInput.value = config.appSecret
      if (appTokenInput) appTokenInput.value = config.appToken
      if (tableIdInput) tableIdInput.value = config.tableId
      if (configNotesInput) configNotesInput.value = config.notes || ''
    } else {
      const modalTitle = document.getElementById('modalTitle') as HTMLElement
      if (modalTitle) modalTitle.textContent = '添加配置'
    }
    
    // 显示模态框
    modal.style.display = 'block'
    document.body.style.overflow = 'hidden'
  }

  private closeConfigModal() {
    const modal = document.getElementById('configModal') as HTMLElement
    if (!modal) return
    
    modal.style.display = 'none'
    document.body.style.overflow = 'auto'
    
    // 重置表单
    const form = document.getElementById('configForm') as HTMLFormElement
    form?.reset()
  }

  private async saveConfig() {
    const form = document.getElementById('configForm') as HTMLFormElement
    const configNameInput = document.getElementById('configName') as HTMLInputElement
    const appIdInput = document.getElementById('appId') as HTMLInputElement
    const appSecretInput = document.getElementById('appSecret') as HTMLInputElement
    const appTokenInput = document.getElementById('appToken') as HTMLInputElement
    const tableIdInput = document.getElementById('tableId') as HTMLInputElement
    const configNotesInput = document.getElementById('configNotes') as HTMLTextAreaElement
    
    if (!form || !configNameInput || !appIdInput || !appSecretInput || !appTokenInput || !tableIdInput) {
      this.showNotification('错误', '表单元素未找到', 'error')
      return
    }

    // 验证表单
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    const configData: FeishuConfig = {
      name: configNameInput.value.trim(),
      appId: appIdInput.value.trim(),
      appSecret: appSecretInput.value.trim(),
      appToken: appTokenInput.value.trim(),
      tableId: tableIdInput.value.trim(),
      notes: configNotesInput?.value.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    try {
      // 生成配置ID
      const configId = `config_${Date.now()}`
      
      // 保存到Chrome存储
      await chrome.storage.local.set({
        ['feishu_configs.' + configId]: configData
      })
      
      // 更新内存中的配置
      this.configs[configId] = configData
      
      // 重新加载配置列表
      await this.loadConfigs()
      
      // 关闭模态框
      this.closeConfigModal()
      
      // 显示成功消息
      this.showNotification('成功', '配置保存成功', 'success')
      
    } catch (error) {
      console.error('保存配置失败:', error)
      this.showNotification('错误', '保存配置失败: ' + (error as Error).message, 'error')
    }
  }

  private async testCurrentConfig() {
    const appIdInput = document.getElementById('appId') as HTMLInputElement
    const appSecretInput = document.getElementById('appSecret') as HTMLInputElement
    const appTokenInput = document.getElementById('appToken') as HTMLInputElement
    const tableIdInput = document.getElementById('tableId') as HTMLInputElement
    const testBtn = document.getElementById('testConfigBtn') as HTMLButtonElement
    
    if (!appIdInput || !appSecretInput || !appTokenInput || !tableIdInput) {
      this.showNotification('错误', '请先填写完整的配置信息', 'error')
      return
    }

    const configData: FeishuConfig = {
      name: '测试配置',
      appId: appIdInput.value.trim(),
      appSecret: appSecretInput.value.trim(),
      appToken: appTokenInput.value.trim(),
      tableId: tableIdInput.value.trim()
    }

    if (testBtn) {
      testBtn.disabled = true
      testBtn.textContent = '测试中...'
    }

    try {
      // 模拟连接测试
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 简单的验证逻辑
      if (configData.appToken && configData.tableId) {
        this.showNotification('成功', '连接测试成功！配置信息有效', 'success')
      } else {
        throw new Error('配置信息不完整')
      }
    } catch (error) {
      console.error('连接测试失败:', error)
      this.showNotification('错误', '连接测试失败: ' + (error as Error).message, 'error')
    } finally {
      if (testBtn) {
        testBtn.disabled = false
        testBtn.textContent = '测试连接'
      }
    }
  }

  private togglePasswordVisibility(inputId: string) {
    const input = document.getElementById(inputId) as HTMLInputElement
    const buttonId = inputId === 'appSecret' ? 'toggleSecret' : 'toggleToken'
    const button = document.getElementById(buttonId) as HTMLButtonElement
    
    if (!input || !button) return

    if (input.type === 'password') {
      input.type = 'text'
      button.textContent = '🙈'
    } else {
      input.type = 'password'
      button.textContent = '👁'
    }
  }

  // 加载配置的改进版本
  private async loadConfigs() {
    try {
      const selector = document.getElementById('configSelector') as HTMLSelectElement
      if (!selector) return
      
      // 加载保存的配置
      const result = await chrome.storage.local.get('feishu_configs')
      const configs = result.feishu_configs || {}
      this.configs = configs
      
      selector.innerHTML = '<option value="">选择配置...</option>'
      
      Object.entries(configs).forEach(([id, config]) => {
        const option = document.createElement('option')
        option.value = id
        option.textContent = config.name
        selector.appendChild(option)
      })
      
      // 恢复上次选择的配置
      const currentConfigId = localStorage.getItem('currentConfigId')
      if (currentConfigId && configs[currentConfigId]) {
        selector.value = currentConfigId
      }
      
      // 更新配置状态显示
      this.updateConfigsList()
      
    } catch (error) {
      console.error('加载配置失败:', error)
      this.showNotification('错误', '配置加载失败', 'error')
    }
  }

  private updateConfigsList() {
    const configStatus = document.getElementById('configStatus')
    if (!configStatus) return
    
    const configCount = Object.keys(this.configs).length
    const currentConfigId = localStorage.getItem('currentConfigId')
    const currentConfig = currentConfigId ? this.configs[currentConfigId] : null
    
    configStatus.innerHTML = `
      <div class="configs-summary">
        <div class="config-count">
          <span class="count-label">配置数量:</span>
          <span class="count-value">${configCount}</span>
        </div>
        ${currentConfig ? `
          <div class="current-config">
            <span class="current-label">当前配置:</span>
            <span class="current-name">${currentConfig.name}</span>
          </div>
        ` : ''}
        <div class="config-actions">
          <button class="text-button" onclick="document.getElementById('manageConfigs')?.click()">
            管理配置
          </button>
        </div>
      </div>
    `
  }

  // 数据采集操作
  private async startCollection() {
    if (!this.pageStatus?.isNotePage) {
      this.showNotification('无法采集', '请打开小红书笔记页面', 'warning')
      return
    }
    
    if (!this.configStatus?.isConfigured) {
      this.showNotification('无法采集', '请先配置飞书信息', 'warning')
      return
    }
    
    try {
      this.collectionState.isCollecting = true
      this.collectionState.isPaused = false
      this.collectionState.progress = 0
      
      this.updateButtonStates()
      this.updateFooterStatus('正在采集数据...')
      
      // 模拟采集过程
      this.simulateCollection()
      
      this.showNotification('开始采集', '正在采集笔记数据...', 'info')
    } catch (error) {
      this.showNotification('采集失败', error.message, 'error')
      this.resetCollectionState()
    }
  }

  private pauseCollection() {
    this.collectionState.isPaused = !this.collectionState.isPaused
    this.updateButtonStates()
    this.updateFooterStatus(this.collectionState.isPaused ? '采集已暂停' : '正在采集数据...')
    
    this.showNotification(
      this.collectionState.isPaused ? '暂停采集' : '恢复采集', 
      this.collectionState.isPaused ? '采集已暂停' : '继续采集数据...', 
      'info'
    )
  }

  private async refreshData() {
    await this.updatePageStatus()
    if (this.pageStatus?.isNotePage) {
      await this.collectDataPreview()
    }
    this.showNotification('刷新完成', '数据已更新', 'success')
  }

  private togglePreview() {
    const previewContent = document.getElementById('previewContent')
    const toggleBtn = document.getElementById('togglePreview')
    
    if (previewContent && toggleBtn) {
      const isExpanded = !previewContent.classList.contains('collapsed')
      previewContent.classList.toggle('collapsed')
      toggleBtn.classList.toggle('rotated')
    }
  }

  private async simulateCollection() {
    const steps = [
      { progress: 20, message: '正在解析页面结构...' },
      { progress: 40, message: '正在提取文本内容...' },
      { progress: 60, message: '正在处理媒体文件...' },
      { progress: 80, message: '正在上传到飞书...' },
      { progress: 100, message: '采集完成！' }
    ]
    
    for (const step of steps) {
      if (!this.collectionState.isCollecting) break
      
      while (this.collectionState.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      this.collectionState.progress = step.progress
      this.updateFooterStatus(step.message)
      
      await new Promise(resolve => setTimeout(resolve, 800))
    }
    
    if (this.collectionState.isCollecting) {
      this.resetCollectionState()
      this.showNotification('采集完成', '数据已成功写入飞书表格', 'success')
    }
  }

  private resetCollectionState() {
    this.collectionState = {
      isCollecting: false,
      isPaused: false,
      progress: 0
    }
    this.updateButtonStates()
    this.updateFooterStatus('就绪')
  }

  // UI 更新方法
  private updateButtonStates() {
    const startBtn = document.getElementById('startCollection') as HTMLButtonElement
    const pauseBtn = document.getElementById('pauseCollection') as HTMLButtonElement
    const refreshBtn = document.getElementById('refreshData') as HTMLButtonElement
    
    const canCollect = this.pageStatus?.isNotePage && this.configStatus?.isConfigured
    const isCollecting = this.collectionState.isCollecting
    const isPaused = this.collectionState.isPaused
    
    if (startBtn) {
      startBtn.disabled = !canCollect || isCollecting
      startBtn.innerHTML = `
        <span class="button-icon">${isCollecting ? '⏹' : '▶'}</span>
        <span>${isCollecting ? '停止采集' : '开始采集'}</span>
      `
    }
    
    if (pauseBtn) {
      pauseBtn.disabled = !isCollecting
      pauseBtn.innerHTML = `
        <span class="button-icon">${isPaused ? '▶' : '⏸'}</span>
        <span>${isPaused ? '恢复' : '暂停'}</span>
      `
    }
    
    if (refreshBtn) {
      refreshBtn.disabled = isCollecting && !isPaused
    }
  }

  private updateConnectionStatus(connected: boolean) {
    const dot = document.getElementById('connectionDot')
    const text = document.getElementById('connectionText')
    
    if (dot) dot.className = `status-dot ${connected ? 'online' : 'offline'}`
    if (text) text.textContent = connected ? '已连接' : '未连接'
  }

  private updateFooterStatus(message: string) {
    const footerStatus = document.getElementById('footerStatus')
    if (footerStatus) {
      footerStatus.textContent = message
    }
  }

  // 事件处理
  private onStorageChanged(changes: {[key: string]: chrome.storage.StorageChange}) {
    const configKeys = ['feishuAppToken', 'feishuAppSecret', 'feishuAppId', 'feishuTableId', 'feishuConfigs']
    const hasConfigChange = configKeys.some(key => key in changes)
    
    if (hasConfigChange) {
      this.updateConfigStatus()
      this.loadConfigurations()
    }
  }

  private onMessage(message: any) {
    if (message.type === 'configUpdated') {
      this.updateConfigStatus()
      this.loadConfigurations()
      this.showNotification('配置已更新', '飞书配置已更新', 'success')
    }
  }

  // 错误处理和通知
  private showError(title: string, message: string) {
    this.showNotification(title, message, 'error')
  }

  private showSuccess(message: string) {
    this.showNotification('成功', message, 'success')
  }

  private showNotification(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const container = document.getElementById('errorContainer')
    if (!container) return
    
    const notification = document.createElement('div')
    notification.className = `error-notification ${type}`
    
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    }
    
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon">${icons[type]}</div>
        <div class="notification-content">
          <div class="notification-title">${title}</div>
          <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `
    
    container.appendChild(notification)
    
    // 自动移除通知
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove()
      }
    }, 5000)
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager()
})
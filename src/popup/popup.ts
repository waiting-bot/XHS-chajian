// Popup 界面交互逻辑
import { configManager } from '../utils/configManager';
import { connectionTester } from '../utils/connectionTester';
import { errorNotificationManager, showError, showWarning, showSuccess, showInfo } from '../utils/errorNotification';
import { errorDetailsManager } from '../utils/errorDetails';
import { errorManager } from '../utils/errorManager';
import { initializeLogging, logManager } from '../utils/logManager';
import { initializeRecovery, recoveryManager } from '../utils/recoveryManager';
import { SafeStorage } from '../utils/safeStorage';
import { storageManager } from '../utils/storageManager';

interface NoteData {
  title: string;
  author: string;
  content: string;
  tags: string[];
  likes: number;
  collects: number;
  comments: number;
  images: number;
  videos: number;
}

interface UserNote {
  id: string;
  content: string;
  category: 'general' | 'priority' | 'question';
  tags: string[];
  timestamp: number;
  url?: string;
  noteTitle?: string;
}

class PopupManager {
  private currentNoteData: any = null;
  private configs: any[] = [];
  private currentConfigId: string = 'default';
  private noteHistory: UserNote[] = [];
  private selectedTags: Set<string> = new Set();
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isNoteSectionVisible: boolean = false;
  private isNoteEditorVisible: boolean = false;

  constructor() {
    this.initializeWithReadinessCheck();
  }

  // 带就绪检查的初始化
  private async initializeWithReadinessCheck(): Promise<void> {
    try {
      this.showInitializationStatus('正在初始化系统...');
      
      // 1. 等待存储管理器就绪
      await this.waitForStorageReady();
      
      // 2. 初始化错误处理
      await this.initializeErrorHandling();
      
      // 3. 初始化事件监听器
      this.initializeEventListeners();
      
      // 4. 加载配置和数据
      await this.loadConfigs();
      await this.loadNoteHistory();
      
      // 5. 检查当前页面
      await this.checkCurrentPage();
      
      // 6. 初始化UI组件
      this.initializeTagChips();
      
      this.hideInitializationStatus();
      showSuccess('系统就绪', '所有组件已成功初始化');
    } catch (error) {
      console.error('Popup初始化失败:', error);
      this.showInitializationError('初始化失败', error.message);
    }
  }

  // 等待存储管理器就绪
  private async waitForStorageReady(): Promise<void> {
    const maxAttempts = 10;
    const attemptDelay = 500;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.showInitializationStatus(`正在连接存储 (${attempt}/${maxAttempts})...`);
        
        // 检查存储管理器是否就绪
        await storageManager.ready;
        
        // 测试存储操作
        await SafeStorage.get(['_test']);
        
        console.log('✅ 存储管理器已就绪');
        return;
      } catch (error) {
        console.warn(`存储连接尝试 ${attempt}/${maxAttempts} 失败:`, error);
        
        if (attempt === maxAttempts) {
          throw new Error('无法连接到存储系统，请刷新页面或重启扩展');
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, attemptDelay));
      }
    }
  }

  // 显示初始化状态
  private showInitializationStatus(message: string): void {
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
      const indicatorDot = statusIndicator.querySelector('.indicator-dot');
      const statusText = statusIndicator.querySelector('.status-text');
      
      if (indicatorDot && statusText) {
        indicatorDot.className = 'indicator-dot loading';
        statusText.textContent = message;
      }
    }
  }

  // 隐藏初始化状态
  private hideInitializationStatus(): void {
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
      const indicatorDot = statusIndicator.querySelector('.indicator-dot');
      const statusText = statusIndicator.querySelector('.status-text');
      
      if (indicatorDot && statusText) {
        indicatorDot.className = 'indicator-dot success';
        statusText.textContent = '系统就绪';
      }
    }
  }

  // 显示初始化错误
  private showInitializationError(title: string, message: string): void {
    this.showInitializationStatus('初始化失败');
    showError(title, message);
    
    // 显示用户友好的错误提示
    const errorContainer = document.createElement('div');
    errorContainer.className = 'initialization-error';
    errorContainer.innerHTML = `
      <div class="error-icon">⚠️</div>
      <div class="error-title">${title}</div>
      <div class="error-message">${message}</div>
      <div class="error-actions">
        <button onclick="location.reload()" class="retry-btn">刷新页面</button>
        <button onclick="this.parentElement.parentElement.remove()" class="dismiss-btn">忽略</button>
      </div>
    `;
    
    document.body.insertBefore(errorContainer, document.body.firstChild);
  }

  // 初始化错误处理
  private async initializeErrorHandling(): Promise<void> {
    try {
      this.showInitializationStatus('正在初始化错误处理系统...');
      
      // 初始化错误处理系统
      await initializeLogging();
      await initializeRecovery();
      
      // 注册错误监听器
      errorManager.addEventListener(this.handleGlobalError.bind(this));
      
      // 设置通知配置
      errorNotificationManager.updateConfig({
        duration: 5000,
        maxNotifications: 3,
        position: 'top-right',
        enableSound: false,
        enableDesktop: false,
        showDetails: true
      });

      // 启动性能监控
      try {
        const { performanceMonitor } = await import('../utils/performanceMonitor');
        performanceMonitor.startMonitoring();
      } catch (perfError) {
        console.warn('性能监控启动失败:', perfError);
      }

      // 初始化缓存系统
      try {
        const { initializeCache } = await import('../utils/cacheManager');
        await initializeCache();
      } catch (cacheError) {
        console.warn('缓存系统启动失败:', cacheError);
      }
      
      console.log('✅ 错误处理系统初始化完成');
    } catch (error) {
      console.error('错误处理系统初始化失败:', error);
      // 不抛出错误，允许继续初始化其他组件
    }
  }

  // 处理全局错误
  private handleGlobalError(error: any): void {
    console.log('捕获到全局错误:', error);
    
    // 根据错误类型显示相应的通知
    if (error.level === 'critical' || error.level === 'error') {
      const notificationId = showError(error.type || '系统错误', error.message, error);
      
      // 为严重错误添加查看详情动作
      if (error.level === 'critical') {
        setTimeout(() => {
          errorDetailsManager.showErrorDetails(error);
        }, 1000);
      }
    } else if (error.level === 'warning') {
      showWarning(error.type || '警告', error.message, error);
    } else {
      showInfo(error.type || '提示', error.message, error);
    }
  }

  // 初始化事件监听器
  private initializeEventListeners(): void {
    // 收集按钮
    document.getElementById('collectBtn')?.addEventListener('click', () => {
      this.collectAndWriteToFeishu();
    });

    // 添加备注按钮
    document.getElementById('addNoteBtn')?.addEventListener('click', () => {
      this.showNoteEditor();
    });

    // 备注相关事件
    this.initializeNoteEventListeners();

    // 配置相关按钮
    document.getElementById('testConnection')?.addEventListener('click', () => {
      this.testConnection();
    });

    document.getElementById('saveConfig')?.addEventListener('click', () => {
      this.saveConfig();
    });

    // 配置选择器
    document.getElementById('configSelect')?.addEventListener('change', (e) => {
      this.switchConfig((e.target as HTMLSelectElement).value);
    });

    // 标签芯片事件
    this.initializeTagChipEvents();

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });

    // 监听配置变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && (changes.feishuConfigs || changes.currentConfigId)) {
        this.loadConfigs();
      }
    });
  }

  // 检查当前页面
  private async checkCurrentPage(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url) {
        this.updateStatus('error', '无法获取当前页面URL');
        return;
      }

      const statusIndicator = document.getElementById('statusIndicator');
      const pageInfo = document.getElementById('pageInfo');
      const collectBtn = document.getElementById('collectBtn') as HTMLButtonElement;

      // 检查是否为小红书笔记页面
      if (tab.url.includes('xiaohongshu.com/explore/')) {
        this.updateStatus('loading', '检测中...');
        
        // 向content script发送消息获取笔记信息
        try {
          const response = await chrome.tabs.sendMessage(tab.id!, { action: 'getNoteInfo' });
          
          if (response && response.success) {
            this.currentNoteData = response.data;
            this.displayNoteInfo(response.data);
            this.updateStatus('success', '已检测到小红书笔记');
            collectBtn.disabled = false;
            document.getElementById('addNoteBtn')?.removeAttribute('disabled');
          } else {
            this.updateStatus('error', '无法获取笔记信息');
            collectBtn.disabled = true;
          }
        } catch (error) {
          this.updateStatus('error', '页面加载中，请刷新后重试');
          collectBtn.disabled = true;
        }
      } else {
        this.updateStatus('error', '当前页面不是小红书笔记页面');
        pageInfo!.style.display = 'none';
        collectBtn.disabled = true;
      }
    } catch (error) {
      this.updateStatus('error', '页面检测失败');
    }
  }

  // 更新状态显示
  private updateStatus(type: 'loading' | 'success' | 'error', message: string): void {
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
      const indicatorDot = statusIndicator.querySelector('.indicator-dot');
      const statusText = statusIndicator.querySelector('.status-text');
      
      if (indicatorDot && statusText) {
        indicatorDot.className = `indicator-dot ${type}`;
        statusText.textContent = message;
      }
    }
    
    // 对于错误状态，同时显示通知
    if (type === 'error') {
      showError('操作失败', message);
    }
  }

  // 显示笔记信息
  private displayNoteInfo(data: NoteData): void {
    const pageInfo = document.getElementById('pageInfo');
    const noteTitle = document.getElementById('noteTitle');
    const noteAuthor = document.getElementById('noteAuthor');
    const pageCardContent = document.getElementById('pageCardContent');

    if (pageInfo && noteTitle && noteAuthor && pageCardContent) {
      noteTitle.textContent = data.title || '未知标题';
      noteAuthor.textContent = data.author || '未知作者';
      pageInfo.style.display = 'block';
      pageCardContent.style.display = 'block';
      
      // 显示预览卡片
      const previewCard = document.getElementById('previewCard');
      if (previewCard) {
        previewCard.style.display = 'block';
        this.updateDataPreview(data);
      }
    }
  }

  // 收集并写入飞书
  private async collectAndWriteToFeishu(): Promise<void> {
    if (!this.currentNoteData) {
      this.updateStatus('error', '没有可采集的数据');
      return;
    }

    // 检查配置
    let activeConfig;
    try {
      activeConfig = await configManager.getActiveConfig();
      if (!activeConfig) {
        this.updateStatus('error', '请先配置飞书设置');
        return;
      }
    } catch (configError) {
      this.updateStatus('error', '配置系统异常，请刷新页面重试');
      return;
    }

    const collectBtn = document.getElementById('collectBtn') as HTMLButtonElement;
    const originalText = collectBtn.textContent;
    collectBtn.textContent = '采集中...';
    collectBtn.disabled = true;

    try {
      // 更新数据预览
      this.updateDataPreview(this.currentNoteData);
      
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('无法获取当前标签页信息');
      }

      // 第一步：从content script收集数据
      this.showInitializationStatus('正在从页面采集数据...');
      const contentResponse = await chrome.tabs.sendMessage(tab.id, { action: 'collectNoteData' });
      
      if (!contentResponse || !contentResponse.success) {
        throw new Error(contentResponse?.error || '页面数据采集失败，请刷新页面重试');
      }

      // 第二步：发送到background script处理
      this.showInitializationStatus('正在处理数据并写入飞书...');
      const bgResponse = await chrome.runtime.sendMessage({
        type: 'PROCESS_NOTE_DATA',
        data: contentResponse.data,
        sender: { tab: { url: tab.url } }
      });
      
      if (bgResponse && bgResponse.success) {
        this.updateStatus('success', '✅ 采集成功并写入飞书');
        showSuccess('采集完成', '笔记数据已成功写入飞书表格');
      } else {
        throw new Error(bgResponse?.error || '数据处理失败');
      }
    } catch (error) {
      console.error('采集过程失败:', error);
      
      // 提供用户友好的错误信息
      let errorMessage = '采集失败';
      if (error.message.includes('扩展正在初始化')) {
        errorMessage = '扩展正在初始化中，请稍后再试';
      } else if (error.message.includes('页面数据采集失败')) {
        errorMessage = '页面数据采集失败，请刷新页面后重试';
      } else if (error.message.includes('网络')) {
        errorMessage = '网络连接异常，请检查网络设置';
      } else if (error.message.includes('权限')) {
        errorMessage = '权限不足，请重新安装扩展';
      } else {
        errorMessage = `采集失败: ${error.message}`;
      }
      
      this.updateStatus('error', errorMessage);
      showError('采集失败', errorMessage, error);
    } finally {
      collectBtn.textContent = originalText;
      collectBtn.disabled = false;
      this.hideInitializationStatus();
    }
  }

  // 初始化标签芯片
  private initializeTagChips(): void {
    const tagChips = document.querySelectorAll('.tag-chip');
    tagChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const tagText = (e.target as HTMLElement).getAttribute('data-tag');
        if (tagText) {
          this.toggleTag(tagText);
        }
      });
    });
  }

  // 初始化标签芯片事件
  private initializeTagChipEvents(): void {
    const tagChips = document.querySelectorAll('.tag-chip');
    tagChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const tagText = (e.target as HTMLElement).getAttribute('data-tag');
        if (tagText) {
          this.toggleTag(tagText);
        }
      });
    });
  }

  // 更新数据预览
  private updateDataPreview(data: NoteData): void {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    previewContent.innerHTML = `
      <div class="preview-item">
        <div class="preview-label">标题:</div>
        <div class="preview-value">${data.title}</div>
      </div>
      <div class="preview-item">
        <div class="preview-label">作者:</div>
        <div class="preview-value">${data.author}</div>
      </div>
      <div class="preview-item">
        <div class="preview-label">正文:</div>
        <div class="preview-value">${data.content.substring(0, 100)}${data.content.length > 100 ? '...' : ''}</div>
      </div>
      <div class="preview-item">
        <div class="preview-label">标签:</div>
        <div class="preview-value">
          <div class="preview-tags">
            ${data.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="preview-item">
        <div class="preview-label">互动数据:</div>
        <div class="preview-value">
          <div class="preview-stats">
            <div class="stat-item">
              <span>🔥</span>
              <span>${this.formatNumber(data.likes)}</span>
            </div>
            <div class="stat-item">
              <span>❤️</span>
              <span>${this.formatNumber(data.collects)}</span>
            </div>
            <div class="stat-item">
              <span>💬</span>
              <span>${this.formatNumber(data.comments)}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="preview-item">
        <div class="preview-label">媒体文件:</div>
        <div class="preview-value">
          <div class="preview-stats">
            <div class="stat-item">
              <span>📷</span>
              <span>${data.images}张图片</span>
            </div>
            <div class="stat-item">
              <span>🎥</span>
              <span>${data.videos}个视频</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 格式化数字
  private formatNumber(num: number): string {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }

  // 模拟采集过程
  private simulateCollection(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }

  // 加载配置
  private async loadConfigs(): Promise<void> {
    try {
      this.showInitializationStatus('正在加载配置...');
      
      // 等待配置管理器就绪
      await configManager.ready;
      
      // 使用ConfigManager加载配置
      const configData = await configManager.getConfig();
      this.configs = configData.feishuConfigs || [];
      this.currentConfigId = configData.activeConfigId || 'default';
      
      this.updateConfigSelector();
      this.loadCurrentConfig();
      this.updateConnectionStatus();
      
      console.log('✅ 配置加载完成');
    } catch (error) {
      console.error('加载配置失败:', error);
      
      // 提供用户友好的错误信息
      let errorMessage = '配置加载失败';
      if (error.message.includes('storage')) {
        errorMessage = '存储系统异常，请刷新页面重试';
      } else if (error.message.includes('network')) {
        errorMessage = '网络连接异常，请检查网络设置';
      } else if (error.message.includes('permission')) {
        errorMessage = '权限不足，请重新安装扩展';
      }
      
      this.updateStatus('error', errorMessage);
      
      // 创建默认配置以保持UI可用
      this.configs = [];
      this.currentConfigId = 'default';
      this.updateConfigSelector();
    }
  }

  // 更新配置选择器
  private updateConfigSelector(): void {
    const configSelect = document.getElementById('configSelect') as HTMLSelectElement;
    if (!configSelect) return;

    if (this.configs.length === 0) {
      configSelect.innerHTML = '<option value="">暂无配置</option>';
      return;
    }

    configSelect.innerHTML = this.configs.map(config => 
      `<option value="${config.id}" ${config.id === this.currentConfigId ? 'selected' : ''}>${config.name}</option>`
    ).join('');
  }

  // 加载当前配置
  private async loadCurrentConfig(): Promise<void> {
    const config = this.getCurrentConfig();
    if (!config) return;

    const appIdInput = document.getElementById('appId') as HTMLInputElement;
    const tableIdInput = document.getElementById('tableId') as HTMLInputElement;
    const accessTokenInput = document.getElementById('accessToken') as HTMLInputElement;

    if (appIdInput) appIdInput.value = config.appId || '';
    if (tableIdInput) tableIdInput.value = config.tableId || '';
    if (accessTokenInput) accessTokenInput.value = config.accessToken || '';
  }

  // 获取当前配置
  private getCurrentConfig(): any {
    return this.configs.find(config => config.id === this.currentConfigId) || null;
  }

  // 切换配置
  private async switchConfig(configId: string): Promise<void> {
    try {
      await configManager.setActiveConfig(configId);
      this.currentConfigId = configId;
      this.loadCurrentConfig();
      this.updateConnectionStatus();
    } catch (error) {
      console.error('切换配置失败:', error);
      this.updateStatus('error', '切换配置失败');
    }
  }

  // 保存配置
  private async saveConfig(): Promise<void> {
    const name = prompt('请输入配置名称:');
    if (!name) return;

    const appId = (document.getElementById('appId') as HTMLInputElement).value.trim();
    const tableId = (document.getElementById('tableId') as HTMLInputElement).value.trim();
    const accessToken = (document.getElementById('accessToken') as HTMLInputElement).value.trim();

    if (!appId || !tableId || !accessToken) {
      this.updateStatus('error', '❌ 请填写完整的配置信息');
      return;
    }

    try {
      // 使用ConfigManager创建配置
      const config = {
        name,
        appId,
        tableId,
        accessToken,
        baseUrl: 'https://open.feishu.cn',
        isActive: true
      };

      const result = await configManager.createFeishuConfig(config);
      if (result.success) {
        await this.loadConfigs(); // 重新加载配置
        this.updateStatus('success', '✅ 配置已保存');
      } else {
        throw new Error(result.error || '配置保存失败');
      }
    } catch (error) {
      this.updateStatus('error', '❌ 配置保存失败: ' + (error as Error).message);
    }
  }

  // 验证配置格式
  private validateConfig(appId: string, tableId: string, accessToken: string): boolean {
    // 基础格式验证
    return appId.length > 0 && tableId.length > 0 && accessToken.length > 0;
  }

  // 测试连接
  private async testConnection(): Promise<void> {
    const config = this.getCurrentConfig();
    if (!config || !config.appId || !config.tableId || !config.accessToken) {
      this.updateStatus('error', '❌ 请先填写完整的配置信息');
      return;
    }

    const testBtn = document.getElementById('testConnection') as HTMLButtonElement;
    const originalText = testBtn.textContent;
    testBtn.textContent = '🔄 测试中...';
    testBtn.disabled = true;

    try {
      // 使用ConnectionTester测试连接
      const result = await connectionTester.testConnection(config);
      if (result.success) {
        this.updateStatus('success', '✅ 连接测试成功');
      } else {
        throw new Error(result.error || '连接测试失败');
      }
    } catch (error) {
      this.updateStatus('error', '❌ 连接测试失败: ' + (error as Error).message);
    } finally {
      testBtn.textContent = originalText;
      testBtn.disabled = false;
    }
  }

  // 显示备注编辑器
  private showNoteEditor(): void {
    const noteEditor = document.getElementById('noteEditor');
    if (noteEditor) {
      noteEditor.style.display = 'block';
      this.isNoteEditorVisible = true;
      
      // 聚焦到输入框
      setTimeout(() => {
        const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
        if (noteInput) {
          noteInput.focus();
        }
      }, 100);
    }
  }

  // 关闭备注编辑器
  private closeNoteEditor(): void {
    const noteEditor = document.getElementById('noteEditor');
    if (noteEditor) {
      noteEditor.style.display = 'none';
      this.isNoteEditorVisible = false;
    }
  }

  // 刷新令牌
  private refreshToken(): void {
    const accessTokenInput = document.getElementById('accessToken') as HTMLInputElement;
    const newToken = prompt('请输入新的Access Token:');
    if (newToken) {
      accessTokenInput.value = newToken;
      this.updateStatus('success', '✅ 令牌已更新');
    }
  }

  // 更新连接状态
  private async updateConnectionStatus(): Promise<void> {
    try {
      const config = this.getCurrentConfig();
      const connectionStatus = document.getElementById('connectionStatus');
      
      if (connectionStatus) {
        if (config && config.accessToken) {
          const result = await connectionTester.testConnection(config);
          if (result.success) {
            connectionStatus.innerHTML = `
              <div class="status-dot online"></div>
              <span>已连接</span>
            `;
          } else {
            connectionStatus.innerHTML = `
              <div class="status-dot offline"></div>
              <span>连接失败</span>
            `;
          }
        } else {
          connectionStatus.innerHTML = `
            <div class="status-dot offline"></div>
            <span>未连接</span>
          `;
        }
      }
    } catch (error) {
      const connectionStatus = document.getElementById('connectionStatus');
      if (connectionStatus) {
        connectionStatus.innerHTML = `
          <div class="status-dot offline"></div>
          <span>连接异常</span>
        `;
      }
    }
  }

  // 处理消息
  private handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): void {
    switch (message.action) {
    case 'updateNoteData':
      this.currentNoteData = message.data;
      this.displayNoteInfo(message.data);
      break;
    case 'pageStatusChanged':
      this.checkCurrentPage();
      break;
    }
  }

  // ========== 备注功能相关方法 ==========

  // 初始化备注事件监听器
  private initializeNoteEventListeners(): void {
    // 备注输入框事件
    const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
    if (noteInput) {
      noteInput.addEventListener('input', () => {
        this.updateCharCount();
        this.validateNoteInput();
        this.scheduleAutoSave();
      });

      noteInput.addEventListener('blur', () => {
        this.validateNoteInput();
      });
    }

    // 保存备注按钮
    document.getElementById('saveNoteBtn')?.addEventListener('click', () => {
      this.saveNote();
    });

    // 清空按钮
    document.getElementById('clearNoteBtn')?.addEventListener('click', () => {
      this.clearNote();
    });

    // 显示历史记录按钮
    document.getElementById('showHistoryBtn')?.addEventListener('click', () => {
      this.showNoteHistory();
    });

    // 关闭历史记录按钮
    document.getElementById('closeHistoryBtn')?.addEventListener('click', () => {
      this.hideNoteHistory();
    });

    // 标签建议点击事件
    document.querySelectorAll('.tag-suggestion').forEach(tag => {
      tag.addEventListener('click', (e) => {
        const tagText = (e.target as HTMLElement).getAttribute('data-tag');
        if (tagText) {
          this.toggleTag(tagText);
        }
      });
    });
  }

  // 切换备注区域显示
  private toggleNoteSection(): void {
    const noteSection = document.getElementById('noteSection');
    if (!noteSection) return;

    this.isNoteSectionVisible = !this.isNoteSectionVisible;
    noteSection.style.display = this.isNoteSectionVisible ? 'block' : 'none';

    if (this.isNoteSectionVisible) {
      // 展开时自动聚焦到输入框
      setTimeout(() => {
        const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
        if (noteInput) {
          noteInput.focus();
        }
      }, 100);
    }
  }

  // 更新字符计数
  private updateCharCount(): void {
    const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
    const charCount = document.getElementById('charCount');
    
    if (noteInput && charCount) {
      const count = noteInput.value.length;
      charCount.textContent = count.toString();
      
      // 字符数接近上限时变色提醒
      if (count >= 450) {
        charCount.style.color = '#dc3545';
      } else if (count >= 400) {
        charCount.style.color = '#ffc107';
      } else {
        charCount.style.color = '#666';
      }
    }
  }

  // 验证备注输入
  private validateNoteInput(): boolean {
    const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
    if (!noteInput) return false;

    const value = noteInput.value.trim();
    let isValid = true;

    // 移除之前的验证状态
    noteInput.classList.remove('validation-error', 'validation-success');
    
    // 移除之前的验证消息
    const existingMessage = noteInput.parentElement?.querySelector('.validation-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    if (value.length === 0) {
      // 空内容是允许的，只是没有验证状态
      return true;
    }

    // 验证内容长度
    if (value.length < 2) {
      this.showValidationMessage(noteInput, '备注内容至少需要2个字符');
      isValid = false;
    } else if (value.length > 500) {
      this.showValidationMessage(noteInput, '备注内容不能超过500个字符');
      isValid = false;
    } else {
      // 验证通过
      noteInput.classList.add('validation-success');
    }

    return isValid;
  }

  // 显示验证消息
  private showValidationMessage(input: HTMLTextAreaElement, message: string): void {
    input.classList.add('validation-error');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'validation-message';
    messageDiv.textContent = message;
    
    input.parentElement?.appendChild(messageDiv);
  }

  // 切换标签选择
  private toggleTag(tagText: string): void {
    if (this.selectedTags.has(tagText)) {
      this.selectedTags.delete(tagText);
    } else {
      this.selectedTags.add(tagText);
    }
    
    this.updateTagDisplay();
  }

  // 更新标签显示
  private updateTagDisplay(): void {
    // 更新标签建议状态
    document.querySelectorAll('.tag-suggestion').forEach(tag => {
      const tagText = tag.getAttribute('data-tag');
      if (tagText && this.selectedTags.has(tagText)) {
        tag.classList.add('active');
      } else {
        tag.classList.remove('active');
      }
    });

    // 更新已选标签显示
    const selectedTagsContainer = document.getElementById('selectedTags');
    if (selectedTagsContainer) {
      selectedTagsContainer.innerHTML = Array.from(this.selectedTags).map(tag => 
        `<span class="selected-tag">
          ${tag}
          <span class="remove-tag" data-tag="${tag}">×</span>
        </span>`
      ).join('');

      // 添加删除标签事件
      selectedTagsContainer.querySelectorAll('.remove-tag').forEach(removeBtn => {
        removeBtn.addEventListener('click', (e) => {
          const tagText = (e.target as HTMLElement).getAttribute('data-tag');
          if (tagText) {
            this.toggleTag(tagText);
          }
        });
      });
    }
  }

  // 计划自动保存
  private scheduleAutoSave(): void {
    // 清除之前的定时器
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // 设置新的定时器（2秒后自动保存）
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveNote();
    }, 2000);
  }

  // 自动保存备注
  private async autoSaveNote(): Promise<void> {
    const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
    if (!noteInput || noteInput.value.trim().length === 0) return;

    // 显示自动保存指示器
    this.showAutoSaveIndicator();

    try {
      await this.saveNoteToStorage(false); // false表示是自动保存
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  }

  // 显示自动保存指示器
  private showAutoSaveIndicator(): void {
    // 这里可以添加自动保存的视觉反馈
    console.log('自动保存中...');
  }

  // 保存备注
  private async saveNote(): Promise<void> {
    const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
    if (!noteInput) return;

    const content = noteInput.value.trim();
    
    if (!this.validateNoteInput()) {
      this.updateStatus('error', '❌ 请检查备注内容格式');
      return;
    }

    if (content.length === 0) {
      this.updateStatus('error', '❌ 请输入备注内容');
      return;
    }

    try {
      await this.saveNoteToStorage(true); // true表示是手动保存
      this.updateStatus('success', '✅ 备注保存成功');
      
      // 清空输入
      this.clearNote();
    } catch (error) {
      this.updateStatus('error', '❌ 备注保存失败');
    }
  }

  // 保存备注到存储
  private async saveNoteToStorage(isManualSave: boolean): Promise<void> {
    const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
    const categoryInputs = document.querySelectorAll('input[name="noteCategory"]');
    
    if (!noteInput) return;

    const content = noteInput.value.trim();
    if (content.length === 0) return;

    // 获取选中的分类
    let category: 'general' | 'priority' | 'question' = 'general';
    categoryInputs.forEach(input => {
      if ((input as HTMLInputElement).checked) {
        category = input.value as 'general' | 'priority' | 'question';
      }
    });

    // 创建备注对象
    const note: UserNote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      content,
      category,
      tags: Array.from(this.selectedTags),
      timestamp: Date.now(),
      url: this.getCurrentPageUrl(),
      noteTitle: this.currentNoteData?.title
    };

    // 添加到历史记录
    this.noteHistory.unshift(note);
    
    // 限制历史记录数量（最多50条）
    if (this.noteHistory.length > 50) {
      this.noteHistory = this.noteHistory.slice(0, 50);
    }

    // 保存到Chrome存储
    await SafeStorage.set({ noteHistory: this.noteHistory });

    if (isManualSave) {
      // 手动保存时更新历史记录显示
      this.updateHistoryDisplay();
    }
  }

  // 清空备注
  private clearNote(): void {
    const noteInput = document.getElementById('noteInput') as HTMLTextAreaElement;
    if (noteInput) {
      noteInput.value = '';
      this.updateCharCount();
      this.validateNoteInput();
    }

    // 重置分类选择
    const generalCategory = document.querySelector('input[name="noteCategory"][value="general"]') as HTMLInputElement;
    if (generalCategory) {
      generalCategory.checked = true;
    }

    // 清空标签选择
    this.selectedTags.clear();
    this.updateTagDisplay();

    // 清除验证状态
    if (noteInput) {
      noteInput.classList.remove('validation-error', 'validation-success');
      const existingMessage = noteInput.parentElement?.querySelector('.validation-message');
      if (existingMessage) {
        existingMessage.remove();
      }
    }
  }

  // 显示备注历史记录
  private showNoteHistory(): void {
    const noteHistory = document.getElementById('noteHistory');
    if (noteHistory) {
      noteHistory.style.display = 'block';
      this.updateHistoryDisplay();
    }
  }

  // 隐藏备注历史记录
  private hideNoteHistory(): void {
    const noteHistory = document.getElementById('noteHistory');
    if (noteHistory) {
      noteHistory.style.display = 'none';
    }
  }

  // 更新历史记录显示
  private updateHistoryDisplay(): void {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    if (this.noteHistory.length === 0) {
      historyList.innerHTML = '<div class="history-placeholder">暂无历史记录</div>';
      return;
    }

    historyList.innerHTML = this.noteHistory.map(note => `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-category">${this.getCategoryLabel(note.category)}</span>
          <span class="history-item-time">${this.formatTime(note.timestamp)}</span>
        </div>
        <div class="history-item-content">${this.escapeHtml(note.content)}</div>
        ${note.tags.length > 0 ? `
          <div class="history-item-tags">
            ${note.tags.map(tag => `<span class="history-item-tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
        ${note.noteTitle ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">页面: ${this.escapeHtml(note.noteTitle)}</div>` : ''}
      </div>
    `).join('');
  }

  // 获取分类标签
  private getCategoryLabel(category: string): string {
    const labels = {
      general: '📝 一般备注',
      priority: '⭐ 优先备注',
      question: '❓ 问题备注'
    };
    return labels[category as keyof typeof labels] || category;
  }

  // 格式化时间
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return '刚刚';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  }

  // HTML转义
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 获取当前页面URL
  private getCurrentPageUrl(): string | undefined {
    // 这里可以通过Chrome API获取当前页面URL
    return undefined; // 简化实现
  }

  // 加载备注历史记录
  private async loadNoteHistory(): Promise<void> {
    try {
      const result = await SafeStorage.get(['noteHistory']);
      this.noteHistory = result.noteHistory || [];
    } catch (error) {
      console.error('加载备注历史失败:', error);
      this.noteHistory = [];
    }
  }
}

// 全局函数供HTML调用
function refreshPageStatus(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.checkCurrentPage();
  }
}

function toggleCard(contentId: string): void {
  const content = document.getElementById(contentId);
  const button = content?.previousElementSibling?.querySelector('.expand-button');
  
  if (content && button) {
    const isExpanded = content.classList.contains('expanded');
    content.classList.toggle('expanded');
    button.classList.toggle('rotated');
  }
}

function closeNoteEditor(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.closeNoteEditor();
  }
}

function clearNote(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.clearNote();
  }
}

function showNoteHistory(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.showNoteHistory();
  }
}

function hideNoteHistory(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.hideNoteHistory();
  }
}

function saveNote(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.saveNote();
  }
}

function togglePassword(): void {
  const passwordInput = document.getElementById('accessToken') as HTMLInputElement;
  const toggleButton = document.querySelector('.password-toggle');
  
  if (passwordInput && toggleButton) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      `;
    } else {
      passwordInput.type = 'password';
      toggleButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
    }
  }
}

function testConnection(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.testConnection();
  }
}

function saveConfig(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.saveConfig();
  }
}

// 显示备注编辑器
function showNoteEditor(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.showNoteEditor();
  }
}

// 配置管理相关函数
function createNewConfig(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.createNewConfig();
  }
}

function exportConfig(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.exportConfig();
  }
}

function importConfig(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.importConfig();
  }
}

function closeConfigManagement(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.closeConfigManagement();
  }
}

function closeImportExport(): void {
  const manager = (window as any).popupManager;
  if (manager) {
    manager.closeImportExport();
  }
}

// 初始化Popup管理器
document.addEventListener('DOMContentLoaded', () => {
  const manager = new PopupManager();
  (window as any).popupManager = manager;
});
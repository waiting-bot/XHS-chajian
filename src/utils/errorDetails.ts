// 错误详情显示组件

import { AppError } from '../types/error'
import { errorManager } from './errorManager'
import { logManager } from './logManager'

// 错误详情显示配置
export interface ErrorDetailsConfig {
  showStackTrace: boolean
  showContext: boolean
  showRelatedErrors: boolean
  showPerformanceData: boolean
  enableCopy: boolean
  enableExport: boolean
}

// 错误详情数据
export interface ErrorDetailsData {
  error: AppError
  relatedErrors: AppError[]
  performanceData: any
  logs: any[]
  timestamp: number
}

// 错误详情管理器
export class ErrorDetailsManager {
  private static instance: ErrorDetailsManager
  private config: ErrorDetailsConfig
  private modal: HTMLElement | null = null
  private isVisible = false

  private constructor() {
    this.config = this.getDefaultConfig()
    this.initializeModal()
  }

  static getInstance(): ErrorDetailsManager {
    if (!ErrorDetailsManager.instance) {
      ErrorDetailsManager.instance = new ErrorDetailsManager()
    }
    return ErrorDetailsManager.instance
  }

  // 获取默认配置
  private getDefaultConfig(): ErrorDetailsConfig {
    return {
      showStackTrace: true,
      showContext: true,
      showRelatedErrors: true,
      showPerformanceData: true,
      enableCopy: true,
      enableExport: true,
    }
  }

  // 初始化模态框
  private initializeModal(): void {
    if (typeof document === 'undefined') return

    // 检查是否已存在模态框
    this.modal = document.getElementById('error-details-modal')
    if (!this.modal) {
      this.createModal()
    }
  }

  // 创建模态框
  private createModal(): void {
    if (typeof document === 'undefined') return

    this.modal = document.createElement('div')
    this.modal.id = 'error-details-modal'
    this.modal.className = 'error-details-modal'
    this.modal.innerHTML = `
      <div class="modal-overlay" onclick="errorDetailsManager.hide()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">错误详情</h2>
          <div class="modal-actions">
            ${
              this.config.enableCopy
                ? `
              <button class="action-button" onclick="errorDetailsManager.copyErrorDetails()" title="复制错误详情">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            `
                : ''
            }
            ${
              this.config.enableExport
                ? `
              <button class="action-button" onclick="errorDetailsManager.exportErrorDetails()" title="导出错误详情">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            `
                : ''
            }
            <button class="action-button" onclick="errorDetailsManager.hide()" title="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="modal-body">
          <div class="error-overview">
            <div class="error-header">
              <div class="error-type-badge" id="error-type-badge"></div>
              <div class="error-level-badge" id="error-level-badge"></div>
              <div class="error-id" id="error-id"></div>
            </div>
            <div class="error-message" id="error-message"></div>
            <div class="error-timestamp" id="error-timestamp"></div>
          </div>
          
          <div class="error-sections">
            ${
              this.config.showContext
                ? `
              <div class="error-section">
                <div class="section-header" onclick="errorDetailsManager.toggleSection('context-section')">
                  <h3>错误上下文</h3>
                  <svg class="section-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                <div class="section-content" id="context-section">
                  <pre id="error-context"></pre>
                </div>
              </div>
            `
                : ''
            }
            
            ${
              this.config.showStackTrace
                ? `
              <div class="error-section">
                <div class="section-header" onclick="errorDetailsManager.toggleSection('stack-section')">
                  <h3>堆栈跟踪</h3>
                  <svg class="section-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                <div class="section-content" id="stack-section">
                  <pre id="error-stack"></pre>
                </div>
              </div>
            `
                : ''
            }
            
            ${
              this.config.showPerformanceData
                ? `
              <div class="error-section">
                <div class="section-header" onclick="errorDetailsManager.toggleSection('performance-section')">
                  <h3>性能数据</h3>
                  <svg class="section-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                <div class="section-content" id="performance-section">
                  <div id="error-performance"></div>
                </div>
              </div>
            `
                : ''
            }
            
            ${
              this.config.showRelatedErrors
                ? `
              <div class="error-section">
                <div class="section-header" onclick="errorDetailsManager.toggleSection('related-section')">
                  <h3>相关错误</h3>
                  <svg class="section-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                <div class="section-content" id="related-section">
                  <div id="related-errors"></div>
                </div>
              </div>
            `
                : ''
            }
            
            <div class="error-section">
              <div class="section-header" onclick="errorDetailsManager.toggleSection('logs-section')">
                <h3>相关日志</h3>
                <svg class="section-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div class="section-content" id="logs-section">
                <div id="error-logs"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <div class="error-actions">
            <button class="secondary-button" onclick="errorDetailsManager.retryError()">重试</button>
            <button class="secondary-button" onclick="errorDetailsManager.reportError()">报告错误</button>
            <button class="primary-button" onclick="errorDetailsManager.hide()">关闭</button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(this.modal)
  }

  // 显示错误详情
  async showErrorDetails(error: AppError): Promise<void> {
    if (!this.modal) return

    try {
      // 准备错误详情数据
      const data: ErrorDetailsData = {
        error,
        relatedErrors: await this.getRelatedErrors(error),
        performanceData: await this.getPerformanceData(),
        logs: await this.getRelatedLogs(error),
        timestamp: Date.now(),
      }

      // 更新模态框内容
      this.updateModalContent(data)

      // 显示模态框
      this.show()
    } catch (detailsError) {
      console.error('显示错误详情失败:', detailsError)
    }
  }

  // 获取相关错误
  private async getRelatedErrors(error: AppError): Promise<AppError[]> {
    try {
      const recentErrors = errorManager.getRecentErrors(10)
      return recentErrors.filter(
        e =>
          e.errorId !== error.errorId &&
          (e.type === error.type || e.level === error.level)
      )
    } catch (error) {
      console.error('获取相关错误失败:', error)
      return []
    }
  }

  // 获取性能数据
  private async getPerformanceData(): Promise<any> {
    try {
      if (typeof performance === 'undefined') return null

      return {
        memory: (performance as any).memory
          ? {
              used: Math.round(
                (performance as any).memory.usedJSHeapSize / 1024 / 1024
              ),
              total: Math.round(
                (performance as any).memory.totalJSHeapSize / 1024 / 1024
              ),
              limit: Math.round(
                (performance as any).memory.jsHeapSizeLimit / 1024 / 1024
              ),
            }
          : null,
        timing: performance.timing
          ? {
              loadTime:
                performance.timing.loadEventEnd -
                performance.timing.navigationStart,
              domReady:
                performance.timing.domContentLoadedEventEnd -
                performance.timing.navigationStart,
            }
          : null,
        navigation: performance.navigation
          ? {
              redirectCount: performance.navigation.redirectCount,
              type: performance.navigation.type,
            }
          : null,
      }
    } catch (error) {
      console.error('获取性能数据失败:', error)
      return null
    }
  }

  // 获取相关日志
  private async getRelatedLogs(error: AppError): Promise<any[]> {
    try {
      const logs = logManager.getLogs()
      const errorTime = error.timestamp
      const timeRange = 60000 // 1分钟范围

      return logs
        .filter(log => Math.abs(log.timestamp - errorTime) <= timeRange)
        .slice(0, 20) // 最多20条相关日志
    } catch (error) {
      console.error('获取相关日志失败:', error)
      return []
    }
  }

  // 更新模态框内容
  private updateModalContent(data: ErrorDetailsData): void {
    if (!this.modal) return

    const { error, relatedErrors, performanceData, logs } = data

    // 更新错误概览
    this.updateErrorOverview(error)

    // 更新错误上下文
    if (this.config.showContext) {
      this.updateErrorContext(error)
    }

    // 更新堆栈跟踪
    if (this.config.showStackTrace) {
      this.updateErrorStack(error)
    }

    // 更新性能数据
    if (this.config.showPerformanceData) {
      this.updatePerformanceData(performanceData)
    }

    // 更新相关错误
    if (this.config.showRelatedErrors) {
      this.updateRelatedErrors(relatedErrors)
    }

    // 更新相关日志
    this.updateRelatedLogs(logs)
  }

  // 更新错误概览
  private updateErrorOverview(error: AppError): void {
    if (!this.modal) return

    const typeBadge = this.modal.querySelector('#error-type-badge')
    const levelBadge = this.modal.querySelector('#error-level-badge')
    const errorId = this.modal.querySelector('#error-id')
    const message = this.modal.querySelector('#error-message')
    const timestamp = this.modal.querySelector('#error-timestamp')

    if (typeBadge) {
      typeBadge.textContent = this.getErrorTypeName(error.type)
      typeBadge.className = `error-type-badge ${error.type}`
    }

    if (levelBadge) {
      levelBadge.textContent = this.getErrorLevelName(error.level)
      levelBadge.className = `error-level-badge ${error.level}`
    }

    if (errorId) {
      errorId.textContent = `ID: ${error.errorId}`
    }

    if (message) {
      message.textContent = error.message
    }

    if (timestamp) {
      timestamp.textContent = new Date(error.timestamp).toLocaleString('zh-CN')
    }
  }

  // 更新错误上下文
  private updateErrorContext(error: AppError): void {
    if (!this.modal) return

    const contextElement = this.modal.querySelector('#error-context')
    if (contextElement) {
      contextElement.textContent = JSON.stringify(error.context, null, 2)
    }
  }

  // 更新堆栈跟踪
  private updateErrorStack(error: AppError): void {
    if (!this.modal) return

    const stackElement = this.modal.querySelector('#error-stack')
    if (stackElement) {
      stackElement.textContent = error.detail.stack || '无堆栈信息'
    }
  }

  // 更新性能数据
  private updatePerformanceData(performanceData: any): void {
    if (!this.modal) return

    const performanceElement = this.modal.querySelector('#error-performance')
    if (performanceElement) {
      if (performanceData) {
        performanceElement.innerHTML = `
          <div class="performance-grid">
            ${
              performanceData.memory
                ? `
              <div class="performance-item">
                <div class="performance-label">内存使用</div>
                <div class="performance-value">${performanceData.memory.used}MB / ${performanceData.memory.total}MB</div>
              </div>
            `
                : ''
            }
            ${
              performanceData.timing
                ? `
              <div class="performance-item">
                <div class="performance-label">页面加载时间</div>
                <div class="performance-value">${performanceData.timing.loadTime}ms</div>
              </div>
            `
                : ''
            }
          </div>
        `
      } else {
        performanceElement.textContent = '无性能数据'
      }
    }
  }

  // 更新相关错误
  private updateRelatedErrors(relatedErrors: AppError[]): void {
    if (!this.modal) return

    const relatedElement = this.modal.querySelector('#related-errors')
    if (relatedElement) {
      if (relatedErrors.length > 0) {
        relatedElement.innerHTML = relatedErrors
          .map(
            error => `
          <div class="related-error-item" onclick="errorDetailsManager.showErrorDetailsById('${error.errorId}')">
            <div class="related-error-header">
              <span class="related-error-type">${this.getErrorTypeName(error.type)}</span>
              <span class="related-error-time">${new Date(error.timestamp).toLocaleTimeString('zh-CN')}</span>
            </div>
            <div class="related-error-message">${error.message}</div>
          </div>
        `
          )
          .join('')
      } else {
        relatedElement.textContent = '无相关错误'
      }
    }
  }

  // 更新相关日志
  private updateRelatedLogs(logs: any[]): void {
    if (!this.modal) return

    const logsElement = this.modal.querySelector('#error-logs')
    if (logsElement) {
      if (logs.length > 0) {
        logsElement.innerHTML = logs
          .map(
            log => `
          <div class="log-item">
            <div class="log-header">
              <span class="log-level ${log.level}">${log.level}</span>
              <span class="log-time">${new Date(log.timestamp).toLocaleTimeString('zh-CN')}</span>
            </div>
            <div class="log-message">${log.message}</div>
          </div>
        `
          )
          .join('')
      } else {
        logsElement.textContent = '无相关日志'
      }
    }
  }

  // 显示模态框
  private show(): void {
    if (!this.modal) return

    this.modal.style.display = 'block'
    this.isVisible = true
    document.body.style.overflow = 'hidden'
  }

  // 隐藏模态框
  hide(): void {
    if (!this.modal) return

    this.modal.style.display = 'none'
    this.isVisible = false
    document.body.style.overflow = ''
  }

  // 切换章节显示
  toggleSection(sectionId: string): void {
    if (!this.modal) return

    const section = this.modal.querySelector(`#${sectionId}`)
    const toggle = this.modal.querySelector(
      `[onclick="errorDetailsManager.toggleSection('${sectionId}')"] .section-toggle`
    )

    if (section && toggle) {
      const isVisible = section.style.display !== 'none'
      section.style.display = isVisible ? 'none' : 'block'
      toggle.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)'
    }
  }

  // 复制错误详情
  async copyErrorDetails(): Promise<void> {
    if (!this.modal) return

    try {
      const errorData = this.getExportData()
      const text = JSON.stringify(errorData, null, 2)

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        this.showToast('错误详情已复制到剪贴板')
      }
    } catch (error) {
      console.error('复制错误详情失败:', error)
    }
  }

  // 导出错误详情
  exportErrorDetails(): void {
    if (!this.modal) return

    try {
      const errorData = this.getExportData()
      const text = JSON.stringify(errorData, null, 2)
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `error-details-${Date.now()}.json`
      a.click()

      URL.revokeObjectURL(url)
      this.showToast('错误详情已导出')
    } catch (error) {
      console.error('导出错误详情失败:', error)
    }
  }

  // 获取导出数据
  private getExportData(): any {
    // 这里可以收集当前显示的所有错误详情数据
    return {
      timestamp: Date.now(),
      version: '1.0',
      error: {},
      context: {},
      performance: {},
      logs: [],
    }
  }

  // 重试错误
  retryError(): void {
    // 这里可以实现重试逻辑
    this.showToast('重试功能开发中...')
  }

  // 报告错误
  reportError(): void {
    // 这里可以实现错误报告逻辑
    this.showToast('错误报告功能开发中...')
  }

  // 根据ID显示错误详情
  async showErrorDetailsById(errorId: string): Promise<void> {
    try {
      const recentErrors = errorManager.getRecentErrors(100)
      const error = recentErrors.find(e => e.errorId === errorId)

      if (error) {
        await this.showErrorDetails(error)
      } else {
        this.showToast('找不到指定的错误')
      }
    } catch (error) {
      console.error('显示错误详情失败:', error)
    }
  }

  // 显示提示
  private showToast(message: string): void {
    if (typeof document === 'undefined') return

    const toast = document.createElement('div')
    toast.className = 'error-details-toast'
    toast.textContent = message
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.remove()
    }, 3000)
  }

  // 获取错误类型名称
  private getErrorTypeName(type: string): string {
    const typeNames = {
      network_error: '网络错误',
      api_error: 'API错误',
      data_parse_error: '数据解析错误',
      data_validation_error: '数据验证错误',
      storage_error: '存储错误',
      config_error: '配置错误',
      file_processing_error: '文件处理错误',
      permission_error: '权限错误',
      auth_error: '认证错误',
      memory_error: '内存错误',
      performance_error: '性能错误',
      system_error: '系统错误',
    }
    return typeNames[type] || type
  }

  // 获取错误级别名称
  private getErrorLevelName(level: string): string {
    const levelNames = {
      debug: '调试',
      info: '信息',
      warning: '警告',
      error: '错误',
      critical: '严重',
    }
    return levelNames[level] || level
  }

  // 更新配置
  updateConfig(newConfig: Partial<ErrorDetailsConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // 获取配置
  getConfig(): ErrorDetailsConfig {
    return { ...this.config }
  }

  // 销毁
  destroy(): void {
    if (this.modal) {
      this.modal.remove()
      this.modal = null
    }
  }
}

// 全局错误详情管理器实例
export const errorDetailsManager = ErrorDetailsManager.getInstance()

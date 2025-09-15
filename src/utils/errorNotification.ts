// 错误通知组件

import { AppError, ErrorLevel, ErrorType } from '../types/error'
import { errorManager } from './errorManager'

// 通知配置
export interface NotificationConfig {
  duration: number
  maxNotifications: number
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  enableSound: boolean
  enableDesktop: boolean
  showDetails: boolean
}

// 通知类型
export enum NotificationType {
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  INFO = 'info',
}

// 通知数据接口
export interface NotificationData {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: number
  details?: any
  actions?: NotificationAction[]
  autoClose: boolean
  progress?: number
}

// 通知动作接口
export interface NotificationAction {
  label: string
  onClick: () => void
  icon?: string
  primary?: boolean
}

// 错误通知管理器
export class ErrorNotificationManager {
  private static instance: ErrorNotificationManager
  private notifications: Map<string, NotificationData> = new Map()
  private config: NotificationConfig
  private container: HTMLElement | null = null
  private soundEnabled = false
  private desktopEnabled = false

  private constructor() {
    this.config = this.getDefaultConfig()
    this.initializeContainer()
    this.initializeErrorListener()
    this.checkBrowserSupport()
  }

  static getInstance(): ErrorNotificationManager {
    if (!ErrorNotificationManager.instance) {
      ErrorNotificationManager.instance = new ErrorNotificationManager()
    }
    return ErrorNotificationManager.instance
  }

  // 获取默认配置
  private getDefaultConfig(): NotificationConfig {
    return {
      duration: 5000,
      maxNotifications: 5,
      position: 'top-right',
      enableSound: false,
      enableDesktop: false,
      showDetails: false,
    }
  }

  // 初始化容器
  private initializeContainer(): void {
    if (typeof document === 'undefined') return

    // 查找或创建容器
    this.container = document.getElementById('error-notification-container')
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'error-notification-container'
      this.container.className = 'error-notification-container'
      document.body.appendChild(this.container)
    }

    // 应用位置样式
    this.updateContainerPosition()
  }

  // 更新容器位置
  private updateContainerPosition(): void {
    if (!this.container) return

    // 移除所有位置类
    this.container.classList.remove(
      'top-right',
      'top-left',
      'bottom-right',
      'bottom-left'
    )

    // 添加当前位置类
    this.container.classList.add(this.config.position)
  }

  // 检查浏览器支持
  private checkBrowserSupport(): void {
    if (typeof Notification !== 'undefined') {
      this.desktopEnabled = Notification.permission === 'granted'
    }

    // 检查音频支持
    this.soundEnabled = typeof Audio !== 'undefined'
  }

  // 初始化错误监听器
  private initializeErrorListener(): void {
    errorManager.addEventListener(this.handleAppError.bind(this))
  }

  // 处理应用错误
  private handleAppError(error: AppError): void {
    const notificationType = this.getErrorNotificationType(error.level)

    this.showNotification({
      type: notificationType,
      title: this.getErrorTitle(error),
      message: error.message,
      details: {
        errorId: error.errorId,
        type: error.type,
        level: error.level,
        context: error.context,
        stack: error.detail.stack,
        timestamp: error.timestamp,
      },
      actions: this.getErrorActions(error),
      autoClose: error.level !== ErrorLevel.CRITICAL,
    })
  }

  // 获取错误通知类型
  private getErrorNotificationType(level: ErrorLevel): NotificationType {
    switch (level) {
      case ErrorLevel.DEBUG:
      case ErrorLevel.INFO:
        return NotificationType.INFO
      case ErrorLevel.WARNING:
        return NotificationType.WARNING
      case ErrorLevel.ERROR:
      case ErrorLevel.CRITICAL:
        return NotificationType.ERROR
      default:
        return NotificationType.ERROR
    }
  }

  // 获取错误标题
  private getErrorTitle(error: AppError): string {
    const typeNames = {
      [ErrorType.NETWORK_ERROR]: '网络错误',
      [ErrorType.API_ERROR]: 'API错误',
      [ErrorType.DATA_PARSE_ERROR]: '数据解析错误',
      [ErrorType.DATA_VALIDATION_ERROR]: '数据验证错误',
      [ErrorType.STORAGE_ERROR]: '存储错误',
      [ErrorType.CONFIG_ERROR]: '配置错误',
      [ErrorType.FILE_PROCESSING_ERROR]: '文件处理错误',
      [ErrorType.PERMISSION_ERROR]: '权限错误',
      [ErrorType.AUTH_ERROR]: '认证错误',
      [ErrorType.MEMORY_ERROR]: '内存错误',
      [ErrorType.PERFORMANCE_ERROR]: '性能错误',
      [ErrorType.SYSTEM_ERROR]: '系统错误',
    }

    return typeNames[error.type] || '未知错误'
  }

  // 获取错误动作
  private getErrorActions(error: AppError): NotificationAction[] {
    const actions: NotificationAction[] = []

    // 重试动作
    if (error.retryable) {
      actions.push({
        label: '重试',
        onClick: () => this.retryError(error),
        icon: '🔄',
        primary: false,
      })
    }

    // 查看详情动作
    actions.push({
      label: '查看详情',
      onClick: () => this.showErrorDetails(error),
      icon: '📋',
      primary: false,
    })

    // 复制错误ID
    actions.push({
      label: '复制ID',
      onClick: () => this.copyErrorId(error),
      icon: '📋',
      primary: false,
    })

    // 忽略错误
    actions.push({
      label: '忽略',
      onClick: () => this.dismissNotification(error.errorId),
      icon: '✖️',
      primary: false,
    })

    return actions
  }

  // 显示通知
  showNotification(data: Partial<NotificationData>): string {
    const id = data.id || this.generateNotificationId()
    const notification: NotificationData = {
      id,
      type: data.type || NotificationType.INFO,
      title: data.title || '',
      message: data.message || '',
      timestamp: Date.now(),
      details: data.details,
      actions: data.actions,
      autoClose: data.autoClose !== false,
      progress: data.progress,
    }

    // 添加到通知列表
    this.notifications.set(id, notification)

    // 创建通知元素
    const element = this.createNotificationElement(notification)
    if (element && this.container) {
      this.container.appendChild(element)
    }

    // 播放声音
    if (this.config.enableSound && this.soundEnabled) {
      this.playNotificationSound(notification.type)
    }

    // 显示桌面通知
    if (this.config.enableDesktop && this.desktopEnabled) {
      this.showDesktopNotification(notification)
    }

    // 自动关闭
    if (notification.autoClose) {
      setTimeout(() => {
        this.removeNotification(id)
      }, this.config.duration)
    }

    // 限制通知数量
    this.enforceNotificationLimit()

    return id
  }

  // 创建通知元素
  private createNotificationElement(
    notification: NotificationData
  ): HTMLElement | null {
    if (typeof document === 'undefined') return null

    const element = document.createElement('div')
    element.className = `error-notification ${notification.type}`
    element.dataset.notificationId = notification.id

    const icon = this.getNotificationIcon(notification.type)

    element.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
          <div class="notification-title">${this.escapeHtml(notification.title)}</div>
          <div class="notification-message">${this.escapeHtml(notification.message)}</div>
        </div>
        <button class="notification-close" onclick="errorNotificationManager.removeNotification('${notification.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      ${
        notification.details
          ? `
        <div class="notification-details">
          <div class="details-toggle" onclick="errorNotificationManager.toggleDetails('${notification.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            查看详情
          </div>
          <div class="details-content" style="display: none;">
            <pre>${JSON.stringify(notification.details, null, 2)}</pre>
          </div>
        </div>
      `
          : ''
      }
      
      ${
        notification.actions
          ? `
        <div class="notification-actions">
          ${notification.actions
            .map(
              action => `
            <button class="notification-action ${action.primary ? 'primary' : ''}" 
                    onclick="errorNotificationManager.executeAction('${notification.id}', ${action.onClick.toString()})">
              ${action.icon || ''} ${action.label}
            </button>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }
      
      ${
        notification.progress !== undefined
          ? `
        <div class="notification-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${notification.progress}%"></div>
          </div>
        </div>
      `
          : ''
      }
    `

    // 添加动画
    element.style.animation = 'slideIn 0.3s ease-out'

    return element
  }

  // 获取通知图标
  private getNotificationIcon(type: NotificationType): string {
    const icons = {
      [NotificationType.SUCCESS]: '✅',
      [NotificationType.WARNING]: '⚠️',
      [NotificationType.ERROR]: '❌',
      [NotificationType.INFO]: 'ℹ️',
    }
    return icons[type] || 'ℹ️'
  }

  // 播放通知声音
  private playNotificationSound(type: NotificationType): void {
    // 这里可以播放不同的声音文件
    // 目前使用浏览器内置的Audio API
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // 根据类型设置不同的频率
      const frequencies = {
        [NotificationType.SUCCESS]: 800,
        [NotificationType.WARNING]: 600,
        [NotificationType.ERROR]: 400,
        [NotificationType.INFO]: 1000,
      }

      oscillator.frequency.value = frequencies[type] || 800
      oscillator.type = 'sine'
      gainNode.gain.value = 0.1

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.error('播放通知声音失败:', error)
    }
  }

  // 显示桌面通知
  private showDesktopNotification(notification: NotificationData): void {
    if (!('Notification' in window)) return

    try {
      const notificationInstance = new Notification(notification.title, {
        body: notification.message,
        icon: '/icon48.svg',
        badge: '/icon16.svg',
        tag: notification.id,
        requireInteraction: !notification.autoClose,
      })

      notificationInstance.onclick = () => {
        window.focus()
        notificationInstance.close()
      }
    } catch (error) {
      console.error('显示桌面通知失败:', error)
    }
  }

  // 移除通知
  removeNotification(id: string): void {
    const element = document.querySelector(`[data-notification-id="${id}"]`)
    if (element) {
      element.style.animation = 'slideOut 0.3s ease-in'
      setTimeout(() => {
        element.remove()
      }, 300)
    }

    this.notifications.delete(id)
  }

  // 切换详情显示
  toggleDetails(id: string): void {
    const element = document.querySelector(`[data-notification-id="${id}"]`)
    if (!element) return

    const detailsContent = element.querySelector('.details-content')
    const toggleButton = element.querySelector('.details-toggle svg')

    if (detailsContent && toggleButton) {
      const isVisible = detailsContent.style.display !== 'none'
      detailsContent.style.display = isVisible ? 'none' : 'block'
      toggleButton.style.transform = isVisible
        ? 'rotate(0deg)'
        : 'rotate(180deg)'
    }
  }

  // 执行动作
  executeAction(id: string, action: () => void): void {
    try {
      action()
      this.removeNotification(id)
    } catch (error) {
      console.error('执行通知动作失败:', error)
    }
  }

  // 重试错误
  private retryError(error: AppError): void {
    console.log('重试错误:', error.errorId)
    // 这里可以实现重试逻辑
  }

  // 显示错误详情
  private showErrorDetails(error: AppError): void {
    console.log('显示错误详情:', error.errorId)
    // 这里可以打开错误详情模态框
  }

  // 复制错误ID
  private copyErrorId(error: AppError): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(error.errorId).then(() => {
        this.showNotification({
          type: NotificationType.SUCCESS,
          title: '复制成功',
          message: '错误ID已复制到剪贴板',
          autoClose: true,
        })
      })
    }
  }

  // 驳回通知
  private dismissNotification(id: string): void {
    this.removeNotification(id)
  }

  // 强制通知数量限制
  private enforceNotificationLimit(): void {
    const notifications = Array.from(this.notifications.values())
    if (notifications.length > this.config.maxNotifications) {
      const toRemove = notifications.slice(
        0,
        notifications.length - this.config.maxNotifications
      )
      toRemove.forEach(notification => {
        this.removeNotification(notification.id)
      })
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.updateContainerPosition()
    this.checkBrowserSupport()
  }

  // 清除所有通知
  clearAllNotifications(): void {
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.notifications.clear()
  }

  // 获取通知统计
  getNotificationStats(): {
    total: number
    byType: Record<NotificationType, number>
    active: number
  } {
    const notifications = Array.from(this.notifications.values())
    const byType = {} as Record<NotificationType, number>

    notifications.forEach(notification => {
      byType[notification.type] = (byType[notification.type] || 0) + 1
    })

    return {
      total: notifications.length,
      byType,
      active: notifications.filter(n => n.autoClose === false).length,
    }
  }

  // 生成通知ID
  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // HTML转义
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// 全局错误通知管理器实例
export const errorNotificationManager = ErrorNotificationManager.getInstance()

// 便捷函数
export function showError(
  title: string,
  message: string,
  details?: any
): string {
  return errorNotificationManager.showNotification({
    type: NotificationType.ERROR,
    title,
    message,
    details,
    autoClose: false,
  })
}

export function showWarning(
  title: string,
  message: string,
  details?: any
): string {
  return errorNotificationManager.showNotification({
    type: NotificationType.WARNING,
    title,
    message,
    details,
    autoClose: true,
  })
}

export function showSuccess(
  title: string,
  message: string,
  details?: any
): string {
  return errorNotificationManager.showNotification({
    type: NotificationType.SUCCESS,
    title,
    message,
    details,
    autoClose: true,
  })
}

export function showInfo(
  title: string,
  message: string,
  details?: any
): string {
  return errorNotificationManager.showNotification({
    type: NotificationType.INFO,
    title,
    message,
    details,
    autoClose: true,
  })
}

// 请求桌面通知权限
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

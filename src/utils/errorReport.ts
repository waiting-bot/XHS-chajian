// 错误报告功能

import { AppError, ErrorLevel, ErrorType } from '../types/error'
import { errorManager } from './errorManager'
import { logManager } from './logManager'

// 报告配置
export interface ErrorReportConfig {
  enableAutoReport: boolean
  reportEndpoint?: string
  includeLogs: boolean
  includeContext: boolean
  includePerformance: boolean
  maxRetryAttempts: number
  retryDelay: number
}

// 报告数据
export interface ErrorReportData {
  id: string
  timestamp: number
  error: AppError
  context: any
  logs: any[]
  performance: any
  environment: any
  userAgent: string
  url: string
  version: string
}

// 报告结果
export interface ErrorReportResult {
  success: boolean
  reportId?: string
  message: string
  error?: any
}

// 错误报告管理器
export class ErrorReportManager {
  private static instance: ErrorReportManager
  private config: ErrorReportConfig
  private pendingReports: Map<string, ErrorReportData> = new Map()
  private retryTimers: Map<string, NodeJS.Timeout> = new Map()
  private isOnline = true

  private constructor() {
    this.config = this.getDefaultConfig()
    this.initializeOnlineMonitoring()
  }

  static getInstance(): ErrorReportManager {
    if (!ErrorReportManager.instance) {
      ErrorReportManager.instance = new ErrorReportManager()
    }
    return ErrorReportManager.instance
  }

  // 获取默认配置
  private getDefaultConfig(): ErrorReportConfig {
    return {
      enableAutoReport: false,
      includeLogs: true,
      includeContext: true,
      includePerformance: true,
      maxRetryAttempts: 3,
      retryDelay: 5000,
    }
  }

  // 初始化在线状态监控
  private initializeOnlineMonitoring(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.processPendingReports()
      })

      window.addEventListener('offline', () => {
        this.isOnline = false
      })
    }
  }

  // 创建错误报告
  async createReport(error: AppError): Promise<ErrorReportData> {
    const reportId = this.generateReportId()

    const report: ErrorReportData = {
      id: reportId,
      timestamp: Date.now(),
      error,
      context: this.config.includeContext ? error.context : null,
      logs: this.config.includeLogs ? await this.getRelatedLogs(error) : [],
      performance: this.config.includePerformance
        ? await this.getPerformanceData()
        : null,
      environment: await this.getEnvironmentInfo(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      version: '1.0.0',
    }

    return report
  }

  // 提交错误报告
  async submitReport(error: AppError): Promise<ErrorReportResult> {
    try {
      // 创建报告数据
      const report = await this.createReport(error)

      // 如果启用自动报告且有端点，则发送到服务器
      if (this.config.enableAutoReport && this.config.reportEndpoint) {
        return await this.sendToServer(report)
      }

      // 否则只是本地存储
      this.saveLocalReport(report)

      return {
        success: true,
        reportId: report.id,
        message: '错误报告已创建',
      }
    } catch (error) {
      return {
        success: false,
        message: '创建错误报告失败',
        error,
      }
    }
  }

  // 发送到服务器
  private async sendToServer(
    report: ErrorReportData
  ): Promise<ErrorReportResult> {
    if (!this.isOnline) {
      // 离线时加入待发送队列
      this.pendingReports.set(report.id, report)
      return {
        success: false,
        message: '网络离线，报告已加入队列',
      }
    }

    try {
      const response = await fetch(this.config.reportEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        reportId: report.id,
        message: result.message || '错误报告已发送',
      }
    } catch (error) {
      // 发送失败，加入重试队列
      this.addToRetryQueue(report)

      return {
        success: false,
        message: '发送错误报告失败，将重试',
        error,
      }
    }
  }

  // 添加到重试队列
  private addToRetryQueue(report: ErrorReportData): void {
    this.pendingReports.set(report.id, report)

    // 延迟重试
    const timer = setTimeout(async () => {
      await this.retryReport(report.id)
    }, this.config.retryDelay)

    this.retryTimers.set(report.id, timer)
  }

  // 重试报告
  private async retryReport(reportId: string): Promise<void> {
    const report = this.pendingReports.get(reportId)
    if (!report) return

    try {
      const result = await this.sendToServer(report)
      if (result.success) {
        this.pendingReports.delete(reportId)
        this.retryTimers.delete(reportId)
      } else {
        // 继续重试，直到达到最大次数
        const attempt = this.getRetryAttempt(reportId) + 1
        if (attempt < this.config.maxRetryAttempts) {
          this.setRetryAttempt(reportId, attempt)
          this.addToRetryQueue(report)
        } else {
          // 达到最大重试次数，保存到本地
          this.saveLocalReport(report)
          this.pendingReports.delete(reportId)
          this.retryTimers.delete(reportId)
          this.clearRetryAttempt(reportId)
        }
      }
    } catch (error) {
      console.error('重试错误报告失败:', error)
    }
  }

  // 处理待发送的报告
  private async processPendingReports(): Promise<void> {
    const reports = Array.from(this.pendingReports.values())

    for (const report of reports) {
      await this.retryReport(report.id)
    }
  }

  // 保存本地报告
  private saveLocalReport(report: ErrorReportData): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['errorReports']).then(result => {
          const reports = result.errorReports || []
          reports.push(report)

          // 限制保存的报告数量
          if (reports.length > 100) {
            reports.splice(0, reports.length - 100)
          }

          chrome.storage.local.set({ errorReports: reports })
        })
      }
    } catch (error) {
      console.error('保存本地错误报告失败:', error)
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
        .slice(0, 20)
    } catch (error) {
      console.error('获取相关日志失败:', error)
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

  // 获取环境信息
  private async getEnvironmentInfo(): Promise<any> {
    try {
      return {
        browser: this.getBrowserInfo(),
        extension:
          typeof chrome !== 'undefined' && chrome.runtime
            ? {
                id: chrome.runtime.id,
                version: chrome.runtime.getManifest().version,
              }
            : null,
        screen:
          typeof screen !== 'undefined'
            ? {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth,
              }
            : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
      }
    } catch (error) {
      console.error('获取环境信息失败:', error)
      return {}
    }
  }

  // 获取浏览器信息
  private getBrowserInfo(): any {
    if (typeof navigator === 'undefined') return {}

    const userAgent = navigator.userAgent
    let browser = 'unknown'
    let version = 'unknown'

    if (userAgent.includes('Chrome')) {
      browser = 'chrome'
      version = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'
    } else if (userAgent.includes('Firefox')) {
      browser = 'firefox'
      version = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'unknown'
    } else if (userAgent.includes('Safari')) {
      browser = 'safari'
      version = userAgent.match(/Version\/(\d+)/)?.[1] || 'unknown'
    }

    return { browser, version }
  }

  // 获取重试次数
  private getRetryAttempt(reportId: string): number {
    const key = `retry_attempt_${reportId}`
    try {
      return parseInt(localStorage.getItem(key) || '0')
    } catch {
      return 0
    }
  }

  // 设置重试次数
  private setRetryAttempt(reportId: string, attempt: number): void {
    const key = `retry_attempt_${reportId}`
    try {
      localStorage.setItem(key, attempt.toString())
    } catch (error) {
      console.error('设置重试次数失败:', error)
    }
  }

  // 清除重试次数
  private clearRetryAttempt(reportId: string): void {
    const key = `retry_attempt_${reportId}`
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('清除重试次数失败:', error)
    }
  }

  // 生成报告ID
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 获取本地报告
  async getLocalReports(): Promise<ErrorReportData[]> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['errorReports'])
        return result.errorReports || []
      }
      return []
    } catch (error) {
      console.error('获取本地错误报告失败:', error)
      return []
    }
  }

  // 清除本地报告
  async clearLocalReports(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove(['errorReports'])
      }
    } catch (error) {
      console.error('清除本地错误报告失败:', error)
    }
  }

  // 导出报告
  exportReports(reports: ErrorReportData[]): string {
    return JSON.stringify(
      {
        exportedAt: Date.now(),
        version: '1.0.0',
        count: reports.length,
        reports,
      },
      null,
      2
    )
  }

  // 手动报告错误
  async reportErrorManually(
    error: AppError,
    additionalInfo: any = {}
  ): Promise<ErrorReportResult> {
    // 增强错误上下文
    error.context = {
      ...error.context,
      additionalInfo,
      reportedBy: 'user',
      reportedAt: Date.now(),
    }

    return await this.submitReport(error)
  }

  // 获取报告统计
  async getReportStats(): Promise<{
    total: number
    byType: Record<ErrorType, number>
    byLevel: Record<ErrorLevel, number>
    pending: number
    recent: ErrorReportData[]
  }> {
    try {
      const reports = await this.getLocalReports()
      const byType = {} as Record<ErrorType, number>
      const byLevel = {} as Record<ErrorLevel, number>

      reports.forEach(report => {
        byType[report.error.type] = (byType[report.error.type] || 0) + 1
        byLevel[report.error.level] = (byLevel[report.error.level] || 0) + 1
      })

      return {
        total: reports.length,
        byType,
        byLevel,
        pending: this.pendingReports.size,
        recent: reports.slice(-10),
      }
    } catch (error) {
      console.error('获取报告统计失败:', error)
      return {
        total: 0,
        byType: {} as Record<ErrorType, number>,
        byLevel: {} as Record<ErrorLevel, number>,
        pending: 0,
        recent: [],
      }
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<ErrorReportConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // 获取配置
  getConfig(): ErrorReportConfig {
    return { ...this.config }
  }

  // 销毁
  destroy(): void {
    // 清除所有重试定时器
    this.retryTimers.forEach(timer => clearTimeout(timer))
    this.retryTimers.clear()
    this.pendingReports.clear()
  }
}

// 全局错误报告管理器实例
export const errorReportManager = ErrorReportManager.getInstance()

// 便捷函数
export async function reportError(error: AppError): Promise<ErrorReportResult> {
  return await errorReportManager.submitReport(error)
}

export async function reportErrorManually(
  error: AppError,
  additionalInfo?: any
): Promise<ErrorReportResult> {
  return await errorReportManager.reportErrorManually(error, additionalInfo)
}

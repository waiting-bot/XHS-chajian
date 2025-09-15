// 错误日志记录系统

import { AppError, ErrorLevel, ErrorType } from '../types/error'
import { errorManager } from './errorManager'

// 日志级别配置
const LOG_LEVEL_CONFIG = {
  [ErrorLevel.DEBUG]: { console: 'debug', storage: true, report: false },
  [ErrorLevel.INFO]: { console: 'info', storage: true, report: false },
  [ErrorLevel.WARNING]: { console: 'warn', storage: true, report: true },
  [ErrorLevel.ERROR]: { console: 'error', storage: true, report: true },
  [ErrorLevel.CRITICAL]: { console: 'error', storage: true, report: true },
}

// 日志条目接口
export interface LogEntry {
  id: string
  timestamp: number
  level: ErrorLevel
  type: ErrorType
  message: string
  context: any
  errorData: any
  session: string
}

// 日志配置接口
export interface LogConfig {
  maxLogEntries: number
  logLevels: ErrorLevel[]
  enableConsoleLog: boolean
  enableStorageLog: boolean
  enableRemoteReport: boolean
  reportInterval: number
  maxBatchSize: number
}

// 日志管理器
export class LogManager {
  private static instance: LogManager
  private logs: LogEntry[] = []
  private config: LogConfig
  private session: string
  private reportTimer?: NodeJS.Timeout
  private isInitialized = false

  private constructor() {
    this.session = this.generateSessionId()
    this.config = this.getDefaultConfig()
  }

  static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager()
    }
    return LogManager.instance
  }

  // 获取默认配置
  private getDefaultConfig(): LogConfig {
    return {
      maxLogEntries: 1000,
      logLevels: [
        ErrorLevel.INFO,
        ErrorLevel.WARNING,
        ErrorLevel.ERROR,
        ErrorLevel.CRITICAL,
      ],
      enableConsoleLog: true,
      enableStorageLog: true,
      enableRemoteReport: false,
      reportInterval: 300000, // 5分钟
      maxBatchSize: 50,
    }
  }

  // 初始化日志管理器
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 从存储加载配置
      await this.loadConfig()

      // 加载历史日志
      await this.loadLogs()

      // 注册错误监听器
      errorManager.addEventListener(this.handleError.bind(this))

      // 启动定时报告
      this.startReporting()

      this.isInitialized = true
      console.log('日志管理器初始化完成')
    } catch (error) {
      console.error('日志管理器初始化失败:', error)
    }
  }

  // 处理错误事件
  private async handleError(error: AppError): Promise<void> {
    await this.logError(error)
  }

  // 记录错误
  async logError(error: AppError): Promise<void> {
    const levelConfig = LOG_LEVEL_CONFIG[error.level]

    // 检查是否应该记录此级别的错误
    if (!this.config.logLevels.includes(error.level)) {
      return
    }

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: error.timestamp,
      level: error.level,
      type: error.type,
      message: error.message,
      context: error.context,
      errorData: error.toJSON(),
      session: this.session,
    }

    // 控制台日志
    if (this.config.enableConsoleLog && levelConfig.console) {
      this.logToConsole(logEntry, levelConfig.console)
    }

    // 存储日志
    if (this.config.enableStorageLog && levelConfig.storage) {
      await this.logToStorage(logEntry)
    }

    // 远程报告
    if (this.config.enableRemoteReport && levelConfig.report) {
      await this.reportToRemote(logEntry)
    }
  }

  // 记录信息
  async logInfo(message: string, context: any = {}): Promise<void> {
    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level: ErrorLevel.INFO,
      type: ErrorType.SYSTEM_ERROR,
      message,
      context,
      errorData: null,
      session: this.session,
    }

    if (this.config.enableConsoleLog) {
      console.log(`[INFO] ${message}`, context)
    }

    if (this.config.enableStorageLog) {
      await this.logToStorage(logEntry)
    }
  }

  // 记录调试信息
  async logDebug(message: string, context: any = {}): Promise<void> {
    if (!this.config.logLevels.includes(ErrorLevel.DEBUG)) return

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level: ErrorLevel.DEBUG,
      type: ErrorType.SYSTEM_ERROR,
      message,
      context,
      errorData: null,
      session: this.session,
    }

    if (this.config.enableConsoleLog) {
      console.debug(`[DEBUG] ${message}`, context)
    }

    if (this.config.enableStorageLog) {
      await this.logToStorage(logEntry)
    }
  }

  // 控制台日志
  private logToConsole(
    entry: LogEntry,
    method: 'log' | 'info' | 'warn' | 'error' | 'debug'
  ): void {
    const timestamp = new Date(entry.timestamp).toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.type}]`

    console[method](prefix, entry.message, {
      context: entry.context,
      errorData: entry.errorData,
    })
  }

  // 存储日志
  private async logToStorage(entry: LogEntry): Promise<void> {
    try {
      this.logs.push(entry)

      // 限制日志数量
      if (this.logs.length > this.config.maxLogEntries) {
        this.logs = this.logs.slice(-this.config.maxLogEntries)
      }

      // 保存到Chrome存储
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          ['error_logs']: this.logs,
        })
      }
    } catch (error) {
      console.error('存储日志失败:', error)
    }
  }

  // 远程报告
  private async reportToRemote(entry: LogEntry): Promise<void> {
    try {
      // 这里可以实现发送到远程服务器的逻辑
      // 目前只是占位符
      console.log('准备远程报告错误:', entry.id)
    } catch (error) {
      console.error('远程报告失败:', error)
    }
  }

  // 启动定时报告
  private startReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
    }

    this.reportTimer = setInterval(() => {
      this.flushPendingReports()
    }, this.config.reportInterval)
  }

  // 清理待报告的日志
  private async flushPendingReports(): Promise<void> {
    if (!this.config.enableRemoteReport) return

    try {
      const pendingLogs = this.logs.filter(
        log => log.errorData && LOG_LEVEL_CONFIG[log.level].report
      )

      if (pendingLogs.length === 0) return

      // 批量报告
      const batchSize = Math.min(pendingLogs.length, this.config.maxBatchSize)
      const batch = pendingLogs.slice(0, batchSize)

      await this.reportBatch(batch)
    } catch (error) {
      console.error('批量报告失败:', error)
    }
  }

  // 批量报告
  private async reportBatch(entries: LogEntry[]): Promise<void> {
    try {
      console.log(`批量报告 ${entries.length} 条日志`)

      // 这里可以实现批量发送到远程服务器的逻辑
    } catch (error) {
      console.error('批量报告失败:', error)
    }
  }

  // 加载配置
  private async loadConfig(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['log_config'])
        if (result.log_config) {
          this.config = { ...this.config, ...result.log_config }
        }
      }
    } catch (error) {
      console.error('加载日志配置失败:', error)
    }
  }

  // 加载历史日志
  private async loadLogs(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['error_logs'])
        if (result.error_logs && Array.isArray(result.error_logs)) {
          this.logs = result.error_logs
        }
      }
    } catch (error) {
      console.error('加载历史日志失败:', error)
    }
  }

  // 更新配置
  async updateConfig(newConfig: Partial<LogConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          ['log_config']: this.config,
        })
      }
    } catch (error) {
      console.error('保存日志配置失败:', error)
    }
  }

  // 获取日志
  getLogs(level?: ErrorLevel, type?: ErrorType, limit?: number): LogEntry[] {
    let filteredLogs = [...this.logs]

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level)
    }

    if (type) {
      filteredLogs = filteredLogs.filter(log => log.type === type)
    }

    if (limit && limit > 0) {
      filteredLogs = filteredLogs.slice(-limit)
    }

    return filteredLogs.reverse() // 最新的日志在前
  }

  // 获取统计信息
  getStats(): {
    totalLogs: number
    logsByLevel: Record<ErrorLevel, number>
    logsByType: Record<ErrorType, number>
    recentLogs: LogEntry[]
    sessionLogs: number
  } {
    const logsByLevel = {} as Record<ErrorLevel, number>
    const logsByType = {} as Record<ErrorType, number>

    this.logs.forEach(log => {
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1
      logsByType[log.type] = (logsByType[log.type] || 0) + 1
    })

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByType,
      recentLogs: this.logs.slice(-10),
      sessionLogs: this.logs.filter(log => log.session === this.session).length,
    }
  }

  // 清除日志
  async clearLogs(): Promise<void> {
    this.logs = []

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove(['error_logs'])
      }
    } catch (error) {
      console.error('清除日志失败:', error)
    }
  }

  // 导出日志
  exportLogs(): string {
    return JSON.stringify(
      {
        session: this.session,
        timestamp: Date.now(),
        config: this.config,
        logs: this.logs,
        stats: this.getStats(),
      },
      null,
      2
    )
  }

  // 生成日志ID
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 生成会话ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 销毁
  destroy(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
    }
    this.isInitialized = false
  }
}

// 全局日志管理器实例
export const logManager = LogManager.getInstance()

// 初始化日志管理器
export async function initializeLogging(): Promise<void> {
  await logManager.initialize()
}

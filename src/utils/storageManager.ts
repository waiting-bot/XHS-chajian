import type { StorageConfig, BackupData } from '../types/config'

// 延迟导入encryptionManager以避免循环依赖
let encryptionManager: any = null

// 延迟加载encryptionManager
async function getEncryptionManager() {
  if (!encryptionManager) {
    const module = await import('./encryption')
    encryptionManager = module.encryptionManager
  }
  return encryptionManager
}

export interface StorageOptions {
  area?: 'local' | 'sync' | 'session'
  encrypt?: boolean
  compress?: boolean
}

export interface StorageEvent {
  key: string
  oldValue: any
  newValue: any
  area: string
}

export interface BatchOperation {
  key: string
  value: any
  operation: 'set' | 'remove'
}

export class StorageManager {
  private cache: Map<string, { value: any; timestamp: number }> = new Map()
  private listeners: Map<string, Set<(event: StorageEvent) => void>> = new Map()
  private batchQueue: BatchOperation[] = []
  private isProcessing = false
  private isInitialized: boolean = false
  private ready: Promise<void>
  private _resolveReady!: () => void

  constructor() {
    // 初始化ready Promise
    this.ready = new Promise<void>(resolve => {
      this._resolveReady = resolve
    })
    // 不在构造函数中自动初始化，改为懒加载
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // 监听存储变化
      chrome.storage.onChanged.addListener((changes, area) => {
        this.handleStorageChanges(changes, area)
      })

      // 定期清理缓存
      setInterval(() => this.cleanupCache(), 5 * 60 * 1000) // 5分钟

      this.isInitialized = true
      console.log('[StorageManager] initialized successfully')
      this._resolveReady()
    } catch (error) {
      console.error('[StorageManager] initialization failed:', error)
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }
  }

  private handleStorageChanges(
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ): void {
    Object.entries(changes).forEach(([key, change]) => {
      // 更新缓存
      if (this.cache.has(key)) {
        if (change.newValue !== undefined) {
          this.cache.set(key, { value: change.newValue, timestamp: Date.now() })
        } else {
          this.cache.delete(key)
        }
      }

      // 通知监听器
      const keyListeners = this.listeners.get(key)
      if (keyListeners) {
        const event: StorageEvent = {
          key,
          oldValue: change.oldValue,
          newValue: change.newValue,
          area,
        }

        keyListeners.forEach(listener => {
          try {
            listener(event)
          } catch (error) {
            console.error('存储事件监听器执行失败:', error)
          }
        })
      }

      // 通知全局监听器
      const globalListeners = this.listeners.get('*')
      if (globalListeners) {
        const event: StorageEvent = {
          key,
          oldValue: change.oldValue,
          newValue: change.newValue,
          area,
        }

        globalListeners.forEach(listener => {
          try {
            listener(event)
          } catch (error) {
            console.error('全局存储事件监听器执行失败:', error)
          }
        })
      }
    })
  }

  private cleanupCache(): void {
    const now = Date.now()
    const cacheTimeout = 10 * 60 * 1000 // 10分钟

    for (const [key, { timestamp }] of this.cache) {
      if (now - timestamp > cacheTimeout) {
        this.cache.delete(key)
      }
    }
  }

  private async processBatchQueue(): Promise<void> {
    if (this.isProcessing || this.batchQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      const operationsByArea = new Map<string, BatchOperation[]>()

      // 按存储区域分组
      this.batchQueue.forEach(op => {
        const area = 'local' // 默认使用local存储
        if (!operationsByArea.has(area)) {
          operationsByArea.set(area, [])
        }
        operationsByArea.get(area)!.push(op)
      })

      // 批量处理每个区域
      for (const [area, operations] of operationsByArea) {
        await this.processBatchOperations(area, operations)
      }

      this.batchQueue = []
    } catch (error) {
      console.error('批量操作处理失败:', error)
    } finally {
      this.isProcessing = false
    }
  }

  private async processBatchOperations(
    area: string,
    operations: BatchOperation[]
  ): Promise<void> {
    const storage = chrome.storage[area as keyof typeof chrome.storage]

    // 分离设置和删除操作
    const setOperations: Record<string, any> = {}
    const removeKeys: string[] = []

    operations.forEach(op => {
      if (op.operation === 'set') {
        setOperations[op.key] = op.value
      } else if (op.operation === 'remove') {
        removeKeys.push(op.key)
      }
    })

    // 执行批量操作
    const promises: Promise<void>[] = []

    if (Object.keys(setOperations).length > 0) {
      promises.push(
        this.wrapStorageOperation(
          () => storage.set(setOperations),
          'set',
          Object.keys(setOperations)
        )
      )
    }

    if (removeKeys.length > 0) {
      promises.push(
        this.wrapStorageOperation(
          () => storage.remove(removeKeys),
          'remove',
          removeKeys
        )
      )
    }

    await Promise.all(promises)
  }

  /**
   * 统一的Chrome Storage Promise包装器，检查lastError
   */
  private async wrapStorageOperation<T>(
    operation: () => Promise<T> | T,
    operationType: 'get' | 'set' | 'remove',
    keys: string[]
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        const result = operation()

        // 处理Promise结果
        if (result instanceof Promise) {
          result
            .then(value => {
              // 检查Chrome runtime lastError
              if (chrome.runtime && chrome.runtime.lastError) {
                const error = new Error(
                  `[StorageManager] Chrome storage ${operationType} error for keys [${keys.join(', ')}]: ${chrome.runtime.lastError.message}`
                )
                console.error(error.message)
                reject(error)
              } else {
                resolve(value)
              }
            })
            .catch(error => {
              const wrappedError = new Error(
                `[StorageManager] Storage ${operationType} operation failed for keys [${keys.join(', ')}]: ${error.message}`
              )
              console.error(wrappedError.message)
              reject(wrappedError)
            })
        } else {
          // 同步操作结果
          if (chrome.runtime && chrome.runtime.lastError) {
            const error = new Error(
              `[StorageManager] Chrome storage ${operationType} error for keys [${keys.join(', ')}]: ${chrome.runtime.lastError.message}`
            )
            console.error(error.message)
            reject(error)
          } else {
            resolve(result)
          }
        }
      } catch (error) {
        const wrappedError = new Error(
          `[StorageManager] Storage ${operationType} operation failed for keys [${keys.join(', ')}]: ${error instanceof Error ? error.message : String(error)}`
        )
        console.error(wrappedError.message)
        reject(wrappedError)
      }
    })
  }

  async get<T>(
    key: string | string[],
    defaultValue?: T,
    options: StorageOptions = {}
  ): Promise<T | Record<string, T>> {
    await this.ready // 等待初始化完成

    const { area = 'local', encrypt = false } = options

    // 严格key验证
    if (Array.isArray(key)) {
      const validKeys = key.filter(
        k => typeof k === 'string' && k.trim().length > 0
      )
      if (validKeys.length === 0) {
        console.warn(
          '[StorageManager] No valid keys provided for get operation'
        )
        return Array.isArray(key) ? {} : (defaultValue as T)
      }
      return this.getMultiple(validKeys, defaultValue as T, options)
    } else {
      if (!key || typeof key !== 'string' || key.trim().length === 0) {
        throw new Error(`[StorageManager] Invalid storage key: ${String(key)}`)
      }
      return this.getSingle(key, defaultValue as T, options)
    }
  }

  private async getSingle<T>(
    key: string,
    defaultValue: T,
    options: StorageOptions
  ): Promise<T> {
    const { area = 'local', encrypt = false } = options

    // 检查缓存
    const cached = this.cache.get(key)
    if (cached) {
      return cached.value
    }

    try {
      // 检查 Chrome Storage API 是否可用
      if (
        !chrome ||
        !chrome.storage ||
        !chrome.storage[area as keyof typeof chrome.storage]
      ) {
        console.warn(
          `[StorageManager] Chrome Storage API (${area}) not available, returning default value`
        )
        return defaultValue
      }

      const storage = chrome.storage[area as keyof typeof chrome.storage]

      // 使用统一的Promise包装器
      const result = await this.wrapStorageOperation(
        () => storage.get([key]),
        'get',
        [key]
      )
      let value = result[key] ?? defaultValue

      // 解密数据
      if (encrypt && value && typeof value === 'string') {
        try {
          const encManager = await getEncryptionManager()
          value = await encManager.decrypt(value)
        } catch (error) {
          console.error(
            `[StorageManager] Failed to decrypt data ${key}:`,
            error
          )
        }
      }

      // 缓存数据
      this.cache.set(key, { value, timestamp: Date.now() })

      return value
    } catch (error) {
      console.error(`[StorageManager] Failed to get data ${key}:`, error)
      return defaultValue
    }
  }

  private async getMultiple<T>(
    keys: string[],
    defaultValue: T,
    options: StorageOptions
  ): Promise<Record<string, T>> {
    const { area = 'local', encrypt = false } = options

    try {
      // 检查 Chrome Storage API 是否可用
      if (
        !chrome ||
        !chrome.storage ||
        !chrome.storage[area as keyof typeof chrome.storage]
      ) {
        console.warn(
          `[StorageManager] Chrome Storage API (${area}) not available, returning empty object`
        )
        return {}
      }

      const storage = chrome.storage[area as keyof typeof chrome.storage]

      // 使用统一的Promise包装器
      const result = await this.wrapStorageOperation(
        () => storage.get(keys),
        'get',
        keys
      )

      // 处理解密和默认值
      const finalResult: Record<string, T> = {}
      for (const key of keys) {
        let value = result[key] ?? defaultValue

        // 解密数据
        if (encrypt && value && typeof value === 'string') {
          try {
            const encManager = await getEncryptionManager()
            value = await encManager.decrypt(value)
          } catch (error) {
            console.error(
              `[StorageManager] Failed to decrypt data ${key}:`,
              error
            )
          }
        }

        finalResult[key] = value

        // 缓存数据
        this.cache.set(key, { value, timestamp: Date.now() })
      }

      return finalResult
    } catch (error) {
      console.error(
        `[StorageManager] Failed to get multiple keys ${keys.join(', ')}:`,
        error
      )
      return {}
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    await this.ready // 等待初始化完成
    const { area = 'local', encrypt = false } = options

    // 严格key验证
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error(`[StorageManager] Invalid storage key: ${String(key)}`)
    }

    try {
      // 检查 Chrome Storage API 是否可用
      if (
        !chrome ||
        !chrome.storage ||
        !chrome.storage[area as keyof typeof chrome.storage]
      ) {
        console.warn(
          `[StorageManager] Chrome Storage API (${area}) not available, skipping storage operation`
        )
        return
      }

      let processedValue = value

      // 加密数据
      if (encrypt && typeof value === 'string') {
        try {
          const encManager = await getEncryptionManager()
          processedValue = await encManager.encrypt(value)
        } catch (error) {
          console.error(
            `[StorageManager] Failed to encrypt data ${key}:`,
            error
          )
        }
      }

      // 添加到批量队列
      this.batchQueue.push({
        key,
        value: processedValue,
        operation: 'set',
      })

      // 更新缓存
      this.cache.set(key, { value, timestamp: Date.now() })

      // 延迟处理批量队列
      setTimeout(() => this.processBatchQueue(), 100)
    } catch (error) {
      console.error(`[StorageManager] Failed to set data ${key}:`, error)
      throw error
    }
  }

  async remove(
    key: string | string[],
    options: StorageOptions = {}
  ): Promise<void> {
    await this.ready // 等待初始化完成
    const { area = 'local' } = options

    // 严格key验证
    if (Array.isArray(key)) {
      const validKeys = key.filter(
        k => typeof k === 'string' && k.trim().length > 0
      )
      if (validKeys.length === 0) {
        console.warn(
          '[StorageManager] No valid keys provided for remove operation'
        )
        return
      }
      return this.removeMultiple(validKeys, options)
    } else {
      if (!key || typeof key !== 'string' || key.trim().length === 0) {
        throw new Error(`[StorageManager] Invalid storage key: ${String(key)}`)
      }
      return this.removeSingle(key, options)
    }
  }

  private async removeSingle(
    key: string,
    options: StorageOptions
  ): Promise<void> {
    try {
      // 添加到批量队列
      this.batchQueue.push({
        key,
        value: null,
        operation: 'remove',
      })

      // 清除缓存
      this.cache.delete(key)

      // 延迟处理批量队列
      setTimeout(() => this.processBatchQueue(), 100)
    } catch (error) {
      console.error(`[StorageManager] Failed to remove data ${key}:`, error)
      throw error
    }
  }

  private async removeMultiple(
    keys: string[],
    options: StorageOptions
  ): Promise<void> {
    try {
      // 添加到批量队列
      keys.forEach(key => {
        this.batchQueue.push({
          key,
          value: null,
          operation: 'remove',
        })

        // 清除缓存
        this.cache.delete(key)
      })

      // 延迟处理批量队列
      setTimeout(() => this.processBatchQueue(), 100)
    } catch (error) {
      console.error(
        `[StorageManager] Failed to remove multiple keys ${keys.join(', ')}:`,
        error
      )
      throw error
    }
  }

  async clear(area: 'local' | 'sync' | 'session' = 'local'): Promise<void> {
    await this.ready // 等待初始化完成
    try {
      const storage = chrome.storage[area as keyof typeof chrome.storage]
      await this.wrapStorageOperation(() => storage.clear(), 'clear', [area])

      // 清除相关缓存
      this.cache.forEach((_, key) => {
        this.cache.delete(key)
      })
    } catch (error) {
      console.error(`[StorageManager] Failed to clear ${area} storage:`, error)
      throw error
    }
  }

  async getAll<T>(
    area: 'local' | 'sync' | 'session' = 'local'
  ): Promise<Record<string, T>> {
    await this.ready // 等待初始化完成
    try {
      const storage = chrome.storage[area as keyof typeof chrome.storage]
      const result = await this.wrapStorageOperation(
        () => storage.get(null),
        'getAll',
        [area]
      )
      return result as Record<string, T>
    } catch (error) {
      console.error(
        `[StorageManager] Failed to get all ${area} storage data:`,
        error
      )
      return {}
    }
  }

  async getBytesInUse(
    area: 'local' | 'sync' | 'session' = 'local'
  ): Promise<number> {
    await this.ready // 等待初始化完成
    try {
      const storage = chrome.storage[area as keyof typeof chrome.storage]
      return await this.wrapStorageOperation(
        () => storage.getBytesInUse(),
        'getBytesInUse',
        [area]
      )
    } catch (error) {
      console.error(
        `[StorageManager] Failed to get ${area} storage usage:`,
        error
      )
      return 0
    }
  }

  // 监听存储变化
  addListener(
    key: string,
    listener: (event: StorageEvent) => void
  ): () => void {
    this.ensureInitialized() // 不等待，防止阻塞

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key)!.add(listener)

    // 返回取消监听的函数
    return () => {
      const keyListeners = this.listeners.get(key)
      if (keyListeners) {
        keyListeners.delete(listener)
        if (keyListeners.size === 0) {
          this.listeners.delete(key)
        }
      }
    }
  }

  // 移除监听器
  removeListener(key: string, listener: (event: StorageEvent) => void): void {
    const keyListeners = this.listeners.get(key)
    if (keyListeners) {
      keyListeners.delete(listener)
      if (keyListeners.size === 0) {
        this.listeners.delete(key)
      }
    }
  }

  // 获取存储统计信息
  async getStats(area: 'local' | 'sync' | 'session' = 'local'): Promise<{
    totalBytes: number
    quotaBytes: number
    usagePercent: number
    keyCount: number
  }> {
    await this.ensureInitialized()
    try {
      const [bytesInUse, allData] = await Promise.all([
        this.getBytesInUse(area),
        this.getAll(area),
      ])

      // Chrome存储配额限制
      const quotaBytes = area === 'sync' ? 102400 : 10485760 // 100KB for sync, 10MB for local

      return {
        totalBytes: bytesInUse,
        quotaBytes,
        usagePercent: (bytesInUse / quotaBytes) * 100,
        keyCount: Object.keys(allData).length,
      }
    } catch (error) {
      console.error('获取存储统计失败:', error)
      return {
        totalBytes: 0,
        quotaBytes: 0,
        usagePercent: 0,
        keyCount: 0,
      }
    }
  }

  // 备份和恢复功能
  async createBackup(): Promise<BackupData> {
    await this.ensureInitialized()
    try {
      const allData = await this.getAll('local')
      const timestamp = Date.now()

      // 获取加密管理器状态
      const encManager = await getEncryptionManager()
      const backupData: BackupData = {
        version: '1.0.0',
        timestamp,
        checksum: await this.generateChecksum(allData),
        encrypted: encManager.isEncryptionEnabled(),
        data: allData as StorageConfig,
      }

      // 保存备份
      await this.set(`backup_${timestamp}`, backupData)

      // 清理旧备份（保留最近5个）
      await this.cleanupOldBackups(5)

      return backupData
    } catch (error) {
      console.error('创建备份失败:', error)
      throw error
    }
  }

  async restoreBackup(backupData: BackupData): Promise<void> {
    await this.ensureInitialized()
    try {
      // 验证备份完整性
      const isValid = await this.validateBackup(backupData)
      if (!isValid) {
        throw new Error('备份数据验证失败')
      }

      // 恢复数据
      await this.clear('local')

      for (const [key, value] of Object.entries(backupData.data)) {
        await this.set(key, value)
      }

      console.log('备份恢复成功')
    } catch (error) {
      console.error('恢复备份失败:', error)
      throw error
    }
  }

  async getBackups(): Promise<BackupData[]> {
    await this.ensureInitialized()
    try {
      const allData = await this.getAll('local')
      const backups: BackupData[] = []

      Object.entries(allData).forEach(([key, value]) => {
        if (key.startsWith('backup_') && this.isValidBackupData(value)) {
          backups.push(value as BackupData)
        }
      })

      return backups.sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      console.error('获取备份列表失败:', error)
      return []
    }
  }

  private async generateChecksum(data: any): Promise<string> {
    try {
      const dataString = JSON.stringify(data)
      const encoder = new TextEncoder()
      const dataBytes = encoder.encode(dataString)
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('生成校验和失败:', error)
      return ''
    }
  }

  private async validateBackup(backupData: BackupData): Promise<boolean> {
    try {
      const checksum = await this.generateChecksum(backupData.data)
      return checksum === backupData.checksum
    } catch (error) {
      console.error('验证备份失败:', error)
      return false
    }
  }

  private isValidBackupData(data: any): data is BackupData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'number' &&
      typeof data.checksum === 'string' &&
      typeof data.encrypted === 'boolean' &&
      typeof data.data === 'object'
    )
  }

  private async cleanupOldBackups(keepCount: number): Promise<void> {
    try {
      const backups = await this.getBackups()
      const toRemove = backups.slice(keepCount)

      for (const backup of toRemove) {
        await this.remove(`backup_${backup.timestamp}`)
      }
    } catch (error) {
      console.error('清理旧备份失败:', error)
    }
  }

  // 健康检查
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // 检查是否已初始化
      if (!this.isInitialized) {
        issues.push('存储管理器未初始化')
      }

      // 测试存储读写
      try {
        const testKey = '_health_check_test'
        const testValue = Date.now().toString()

        // 测试写入
        await this.set(testKey, testValue)

        // 测试读取
        const readValue = await this.get(testKey)

        // 测试删除
        await this.remove(testKey)

        if (readValue !== testValue) {
          issues.push('存储读写测试失败')
        }
      } catch (error) {
        issues.push('存储读写测试异常: ' + error.message)
      }

      // 检查Chrome API可用性
      if (!chrome.storage || !chrome.storage.local) {
        issues.push('Chrome Storage API 不可用')
      }

      return {
        healthy: issues.length === 0,
        issues,
      }
    } catch (error) {
      issues.push('健康检查异常: ' + error.message)
      return {
        healthy: false,
        issues,
      }
    }
  }
}

// 导出单例实例
export const storageManager = new StorageManager()
export default StorageManager

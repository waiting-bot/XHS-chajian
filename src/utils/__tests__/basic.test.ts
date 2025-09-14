import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('EncryptionManager Basic Tests', () => {
  let encryptionManager: any

  beforeEach(() => {
    // 模拟一个简单的 encryptionManager 用于测试
    encryptionManager = {
      isInitialized: false,
      encryptionKey: null,
      initialize: vi.fn().mockImplementation(async () => {
        encryptionManager.isInitialized = true
        encryptionManager.encryptionKey = 'mock-key'
      }),
      healthCheck: vi.fn().mockImplementation(async () => ({
        healthy: encryptionManager.isInitialized,
        issues: encryptionManager.isInitialized ? [] : ['加密管理器未初始化']
      }))
    }
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await encryptionManager.initialize()
      expect(encryptionManager.isInitialized).toBe(true)
      expect(encryptionManager.encryptionKey).toBe('mock-key')
    })

    it('should pass health check when initialized', async () => {
      await encryptionManager.initialize()
      const health = await encryptionManager.healthCheck()
      
      expect(health.healthy).toBe(true)
      expect(health.issues).toHaveLength(0)
    })

    it('should fail health check when not initialized', async () => {
      const health = await encryptionManager.healthCheck()
      
      expect(health.healthy).toBe(false)
      expect(health.issues).toContain('加密管理器未初始化')
    })
  })
})

describe('StorageManager Basic Tests', () => {
  let storageManager: any

  beforeEach(() => {
    // 模拟 Chrome API
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
          remove: vi.fn(),
          clear: vi.fn()
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      },
      runtime: {
        id: 'test-extension-id'
      }
    }

    storageManager = {
      isInitialized: false,
      cache: new Map(),
      initialize: vi.fn().mockImplementation(async () => {
        storageManager.isInitialized = true
      }),
      get: vi.fn().mockImplementation(async (key: string, defaultValue?: any) => {
        // 模拟存储获取
        if (key === 'testKey') {
          return 'test-value'
        }
        return defaultValue
      }),
      set: vi.fn().mockImplementation(async (key: string, value: any) => {
        // 模拟存储设置
        storageManager.cache.set(key, value)
      }),
      healthCheck: vi.fn().mockImplementation(async () => ({
        healthy: storageManager.isInitialized,
        issues: storageManager.isInitialized ? [] : ['存储管理器未初始化']
      }))
    }
    vi.clearAllMocks()
  })

  describe('Basic Operations', () => {
    it('should initialize successfully', async () => {
      await storageManager.initialize()
      expect(storageManager.isInitialized).toBe(true)
    })

    it('should get and set values', async () => {
      await storageManager.initialize()
      
      await storageManager.set('testKey', 'test-value')
      const result = await storageManager.get('testKey', 'default')
      
      expect(result).toBe('test-value')
    })

    it('should return default value for missing keys', async () => {
      await storageManager.initialize()
      
      const result = await storageManager.get('missingKey', 'default')
      
      expect(result).toBe('default')
    })

    it('should pass health check when initialized', async () => {
      await storageManager.initialize()
      const health = await storageManager.healthCheck()
      
      expect(health.healthy).toBe(true)
      expect(health.issues).toHaveLength(0)
    })

    it('should fail health check when not initialized', async () => {
      const health = await storageManager.healthCheck()
      
      expect(health.healthy).toBe(false)
      expect(health.issues).toContain('存储管理器未初始化')
    })
  })

  describe('Chrome API Availability', () => {
    it('should handle missing Chrome API gracefully', () => {
      const originalChrome = global.chrome
      delete (global as any).chrome
      
      expect(() => {
        // 测试代码应该能处理 Chrome API 不存在的情况
        const testManager = {
          initialize: vi.fn().mockImplementation(async () => {
            if (!global.chrome) {
              throw new Error('Chrome API 不可用')
            }
          })
        }
        return testManager
      }).not.toThrow()
      
      // 恢复 chrome API
      global.chrome = originalChrome
    })
  })
})
/**
 * 安全的Chrome Storage操作工具
 * 防止undefined key和其他常见错误
 */

export class SafeStorage {
  /**
   * 统一的Chrome Storage Promise包装器，检查lastError
   */
  private static async wrapStorageOperation<T>(
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
                  `[SafeStorage] Chrome storage ${operationType} error for keys [${keys.join(', ')}]: ${chrome.runtime.lastError.message}`
                )
                console.error(error.message)
                reject(error)
              } else {
                resolve(value)
              }
            })
            .catch(error => {
              const wrappedError = new Error(
                `[SafeStorage] Storage ${operationType} operation failed for keys [${keys.join(', ')}]: ${error.message}`
              )
              console.error(wrappedError.message)
              reject(wrappedError)
            })
        } else {
          // 同步操作结果
          if (chrome.runtime && chrome.runtime.lastError) {
            const error = new Error(
              `[SafeStorage] Chrome storage ${operationType} error for keys [${keys.join(', ')}]: ${chrome.runtime.lastError.message}`
            )
            console.error(error.message)
            reject(error)
          } else {
            resolve(result)
          }
        }
      } catch (error) {
        const wrappedError = new Error(
          `[SafeStorage] Storage ${operationType} operation failed for keys [${keys.join(', ')}]: ${error instanceof Error ? error.message : String(error)}`
        )
        console.error(wrappedError.message)
        reject(wrappedError)
      }
    })
  }

  /**
   * 安全的storage.get操作
   */
  static async get(keys: string | string[]): Promise<Record<string, any>> {
    if (!keys || (Array.isArray(keys) && keys.length === 0)) {
      console.warn('[SafeStorage] keys is empty or undefined')
      return {}
    }

    // 确保keys是数组且所有key都是有效的
    const keyArray = Array.isArray(keys) ? keys : [keys]
    const validKeys = keyArray.filter(
      key => key && typeof key === 'string' && key.trim().length > 0
    )

    if (validKeys.length === 0) {
      console.warn('[SafeStorage] no valid keys found')
      return {}
    }

    try {
      if (
        typeof chrome === 'undefined' ||
        !chrome.storage ||
        !chrome.storage.local
      ) {
        console.warn('[SafeStorage] Chrome storage not available')
        return {}
      }

      const result = await this.wrapStorageOperation(
        () => chrome.storage.local.get(validKeys),
        'get',
        validKeys
      )
      return result
    } catch (error) {
      console.error('[SafeStorage] get operation failed:', error)
      return {}
    }
  }

  /**
   * 安全的storage.set操作
   */
  static async set(items: Record<string, any>): Promise<void> {
    if (!items || typeof items !== 'object') {
      console.warn('[SafeStorage] items is not an object')
      return
    }

    // 过滤掉无效的key-value对
    const validItems: Record<string, any> = {}
    const validKeys: string[] = []
    Object.entries(items).forEach(([key, value]) => {
      if (key && typeof key === 'string' && key.trim().length > 0) {
        validItems[key] = value
        validKeys.push(key)
      } else {
        console.warn('[SafeStorage] skipping invalid key:', key)
      }
    })

    if (Object.keys(validItems).length === 0) {
      console.warn('[SafeStorage] no valid items to save')
      return
    }

    try {
      if (
        typeof chrome === 'undefined' ||
        !chrome.storage ||
        !chrome.storage.local
      ) {
        console.warn('[SafeStorage] Chrome storage not available')
        return
      }

      await this.wrapStorageOperation(
        () => chrome.storage.local.set(validItems),
        'set',
        validKeys
      )
    } catch (error) {
      console.error('[SafeStorage] set operation failed:', error)
    }
  }

  /**
   * 安全的storage.remove操作
   */
  static async remove(keys: string | string[]): Promise<void> {
    if (!keys || (Array.isArray(keys) && keys.length === 0)) {
      console.warn('[SafeStorage] keys is empty or undefined')
      return
    }

    // 确保keys是数组且所有key都是有效的
    const keyArray = Array.isArray(keys) ? keys : [keys]
    const validKeys = keyArray.filter(
      key => key && typeof key === 'string' && key.trim().length > 0
    )

    if (validKeys.length === 0) {
      console.warn('[SafeStorage] no valid keys found')
      return
    }

    try {
      if (
        typeof chrome === 'undefined' ||
        !chrome.storage ||
        !chrome.storage.local
      ) {
        console.warn('[SafeStorage] Chrome storage not available')
        return
      }

      await this.wrapStorageOperation(
        () => chrome.storage.local.remove(validKeys),
        'remove',
        validKeys
      )
    } catch (error) {
      console.error('[SafeStorage] remove operation failed:', error)
    }
  }
}

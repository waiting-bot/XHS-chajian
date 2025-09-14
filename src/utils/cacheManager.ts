// 缓存机制
import { SafeStorage } from './safeStorage';

// 缓存项接口
export interface CacheItem<T = any> {
  value: T;
  timestamp: number;
  ttl: number; // Time To Live in milliseconds
  hits: number;
}

// 缓存配置接口
export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  enableCompression: boolean;
  cleanupInterval: number;
  enablePersistence: boolean;
}

// 缓存统计接口
export interface CacheStats {
  totalItems: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
  size: number;
}

// 缓存管理器
export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheItem> = new Map();
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private stats: CacheStats = {
    totalItems: 0,
    hitRate: 0,
    missRate: 0,
    totalHits: 0,
    totalMisses: 0,
    evictions: 0,
    size: 0
  };

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeCleanup();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  // 获取默认配置
  private getDefaultConfig(): CacheConfig {
    return {
      maxSize: 1000,
      defaultTTL: 300000, // 5分钟
      enableCompression: false,
      cleanupInterval: 60000, // 1分钟
      enablePersistence: true
    };
  }

  // 初始化清理定时器
  private initializeCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // 设置缓存
  set<T>(key: string, value: T, ttl?: number): void {
    // 如果缓存已满，清理一些空间
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    const item: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      hits: 0
    };

    this.cache.set(key, item);
    this.updateStats('set');

    // 如果启用持久化，保存到存储
    if (this.config.enablePersistence) {
      this.persistCache();
    }
  }

  // 获取缓存
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.updateStats('miss');
      return null;
    }

    // 检查是否过期
    if (this.isExpired(item)) {
      this.cache.delete(key);
      this.updateStats('miss');
      return null;
    }

    // 更新命中次数
    item.hits++;
    this.updateStats('hit');
    
    return item.value;
  }

  // 检查是否存在
  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    if (this.isExpired(item)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // 删除缓存
  delete(key: string): boolean {
    const exists = this.cache.delete(key);
    if (exists) {
      this.updateStats('delete');
    }
    return exists;
  }

  // 清空缓存
  clear(): void {
    this.cache.clear();
    this.stats.totalItems = 0;
    
    if (this.config.enablePersistence) {
      this.clearPersistedCache();
    }
  }

  // 获取或设置缓存（如果不存在）
  getOrSet<T>(key: string, factory: () => T, ttl?: number): T {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = factory();
    this.set(key, value, ttl);
    return value;
  }

  // 异步获取或设置缓存
  async getOrSetAsync<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  // 检查是否过期
  private isExpired(item: CacheItem): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  // 清理过期项
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`缓存清理完成，清理了 ${cleanedCount} 个过期项`);
      
      if (this.config.enablePersistence) {
        this.persistCache();
      }
    }
  }

  // 驱逐策略（LRU - 最近最少使用）
  private evict(): void {
    // 找到最久未使用的项
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.cache.forEach((item, key) => {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      
      if (this.config.enablePersistence) {
        this.persistCache();
      }
    }
  }

  // 更新统计信息
  private updateStats(action: 'hit' | 'miss' | 'set' | 'delete'): void {
    switch (action) {
      case 'hit':
        this.stats.totalHits++;
        break;
      case 'miss':
        this.stats.totalMisses++;
        break;
      case 'set':
        this.stats.totalItems = this.cache.size;
        break;
      case 'delete':
        this.stats.totalItems = this.cache.size;
        break;
    }

    // 计算命中率
    const total = this.stats.totalHits + this.stats.totalMisses;
    if (total > 0) {
      this.stats.hitRate = this.stats.totalHits / total;
      this.stats.missRate = this.stats.totalMisses / total;
    }

    this.stats.size = this.cache.size;
  }

  // 获取统计信息
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // 获取缓存大小
  size(): number {
    return this.cache.size;
  }

  // 获取所有键
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // 获取所有值
  values<T>(): T[] {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  // 持久化缓存到存储
  private async persistCache(): Promise<void> {
    try {
      const cacheData = Array.from(this.cache.entries());
      await SafeStorage.set({ app_cache: cacheData });
    } catch (error) {
      console.error('持久化缓存失败:', error);
    }
  }

  // 从存储加载缓存
  async loadPersistedCache(): Promise<void> {
    try {
      const result = await SafeStorage.get(['app_cache']);
      if (result.app_cache && Array.isArray(result.app_cache)) {
        this.cache.clear();
        
        const now = Date.now();
        result.app_cache.forEach(([key, item]: [string, CacheItem]) => {
          // 只加载未过期的项
          if (now - item.timestamp <= item.ttl) {
            this.cache.set(key, item);
          }
        });
        
        this.stats.totalItems = this.cache.size;
        console.log(`从存储加载了 ${this.cache.size} 个缓存项`);
      }
    } catch (error) {
      console.error('加载持久化缓存失败:', error);
    }
  }

  // 清除持久化的缓存
  private async clearPersistedCache(): Promise<void> {
    try {
      await SafeStorage.remove(['app_cache']);
    } catch (error) {
      console.error('清除持久化缓存失败:', error);
    }
  }

  // 获取缓存项信息
  getItemInfo(key: string): CacheItem | null {
    const item = this.cache.get(key);
    if (!item || this.isExpired(item)) {
      return null;
    }
    return { ...item };
  }

  // 批量设置缓存
  setBatch<T>(items: Array<[string, T, number?]>): void {
    items.forEach(([key, value, ttl]) => {
      this.set(key, value, ttl);
    });
  }

  // 批量获取缓存
  getBatch<T>(keys: string[]): Array<[string, T | null]> {
    return keys.map(key => [key, this.get<T>(key)]);
  }

  // 缓存装饰器
  static cache<T>(ttl?: number) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = function (...args: any[]): T {
        const cacheKey = `${propertyKey}_${JSON.stringify(args)}`;
        const cache = CacheManager.getInstance();
        
        return cache.getOrSet(cacheKey, () => originalMethod.apply(this, args), ttl);
      };
      
      return descriptor;
    };
  }

  // 异步缓存装饰器
  static cacheAsync<T>(ttl?: number) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function (...args: any[]): Promise<T> {
        const cacheKey = `${propertyKey}_${JSON.stringify(args)}`;
        const cache = CacheManager.getInstance();
        
        return await cache.getOrSetAsync(cacheKey, () => originalMethod.apply(this, args), ttl);
      };
      
      return descriptor;
    };
  }

  // 更新配置
  updateConfig(newConfig: Partial<CacheConfig>): void {
    const oldMaxSize = this.config.maxSize;
    this.config = { ...this.config, ...newConfig };

    // 如果最大大小减少，清理多余的项
    if (newConfig.maxSize && newConfig.maxSize < oldMaxSize) {
      while (this.cache.size > this.config.maxSize) {
        this.evict();
      }
    }

    // 重新设置清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.initializeCleanup();
  }

  // 获取配置
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // 销毁
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// 全局缓存管理器实例
export const cacheManager = CacheManager.getInstance();

// 便捷函数
export function setCache<T>(key: string, value: T, ttl?: number): void {
  cacheManager.set(key, value, ttl);
}

export function getCache<T>(key: string): T | null {
  return cacheManager.get<T>(key);
}

export function hasCache(key: string): boolean {
  return cacheManager.has(key);
}

export function deleteCache(key: string): boolean {
  return cacheManager.delete(key);
}

export function clearCache(): void {
  cacheManager.clear();
}

export function getOrSetCache<T>(key: string, factory: () => T, ttl?: number): T {
  return cacheManager.getOrSet(key, factory, ttl);
}

export async function getOrSetCacheAsync<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
  return await cacheManager.getOrSetAsync(key, factory, ttl);
}

// 初始化缓存
export async function initializeCache(): Promise<void> {
  await cacheManager.loadPersistedCache();
}
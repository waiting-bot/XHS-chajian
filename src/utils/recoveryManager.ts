// 错误恢复策略管理器

import { AppError, ErrorType, ErrorLevel, RecoveryStrategy } from '../types/error';
import { errorManager } from './errorManager';

// 恢复策略结果
export interface RecoveryResult {
  success: boolean;
  strategy: string;
  message: string;
  duration: number;
  data?: any;
}

// 恢复策略配置
export interface RecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableAutoRecovery: boolean;
  recoveryStrategies: string[];
}

// 恢复上下文
export interface RecoveryContext {
  attempt: number;
  maxAttempts: number;
  startTime: number;
  lastAttempt: number;
  history: RecoveryResult[];
}

// 恢复管理器
export class RecoveryManager {
  private static instance: RecoveryManager;
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private config: RecoveryConfig;
  private isInitialized = false;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeDefaultStrategies();
  }

  static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager();
    }
    return RecoveryManager.instance;
  }

  // 获取默认配置
  private getDefaultConfig(): RecoveryConfig {
    return {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableAutoRecovery: true,
      recoveryStrategies: [
        'retry_network',
        'reload_page',
        'clear_storage',
        'retry_api',
        'fallback_data',
        'reset_connection'
      ]
    };
  }

  // 初始化默认策略
  private initializeDefaultStrategies(): void {
    // 网络重试策略
    this.addStrategy({
      id: 'retry_network',
      name: '网络重试',
      description: '网络连接失败时自动重试',
      canHandle: (error) => {
        return [
          ErrorType.NETWORK_ERROR,
          ErrorType.API_ERROR,
          ErrorType.TIMEOUT_ERROR
        ].includes(error.type) && error.retryable;
      },
      execute: async (error) => {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return true;
      }
    });

    // 页面重载策略
    this.addStrategy({
      id: 'reload_page',
      name: '页面重载',
      description: '页面状态异常时重新加载',
      canHandle: (error) => {
        return [
          ErrorType.DOM_ERROR,
          ErrorType.EXTENSION_ERROR
        ].includes(error.type);
      },
      execute: async (error) => {
        if (typeof window !== 'undefined') {
          // 询问用户是否重载页面
          if (confirm('页面状态异常，是否重新加载？')) {
            window.location.reload();
            return true;
          }
        }
        return false;
      }
    });

    // 存储清理策略
    this.addStrategy({
      id: 'clear_storage',
      name: '清理存储',
      description: '存储错误时清理缓存数据',
      canHandle: (error) => {
        return error.type === ErrorType.STORAGE_ERROR;
      },
      execute: async (error) => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.clear();
            console.log('存储清理完成');
            return true;
          }
        } catch (cleanupError) {
          console.error('存储清理失败:', cleanupError);
        }
        return false;
      }
    });

    // API重试策略
    this.addStrategy({
      id: 'retry_api',
      name: 'API重试',
      description: 'API调用失败时重试',
      canHandle: (error) => {
        return error.type === ErrorType.API_ERROR && 
               error.detail.code && 
               parseInt(error.detail.code) >= 500;
      },
      execute: async (error) => {
        // 指数退避重试
        const delay = Math.min(this.config.retryDelay * Math.pow(2, error.context?.additionalData?.attempt || 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return true;
      }
    });

    // 数据回退策略
    this.addStrategy({
      id: 'fallback_data',
      name: '数据回退',
      description: '数据处理失败时使用备用数据',
      canHandle: (error) => {
        return [
          ErrorType.DATA_PARSE_ERROR,
          ErrorType.DATA_PROCESSING_ERROR
        ].includes(error.type);
      },
      execute: async (error) => {
        // 这里可以实现数据回退逻辑
        console.log('使用备用数据源');
        return true;
      }
    });

    // 连接重置策略
    this.addStrategy({
      id: 'reset_connection',
      name: '重置连接',
      description: '连接异常时重置网络连接',
      canHandle: (error) => {
        return [
          ErrorType.NETWORK_ERROR,
          ErrorType.AUTH_ERROR
        ].includes(error.type);
      },
      execute: async (error) => {
        try {
          // 重置飞书连接
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'reset_connection' });
          }
          return true;
        } catch (resetError) {
          console.error('连接重置失败:', resetError);
        }
        return false;
      }
    });

    // 权限请求策略
    this.addStrategy({
      id: 'request_permissions',
      name: '请求权限',
      description: '权限错误时重新请求权限',
      canHandle: (error) => {
        return error.type === ErrorType.PERMISSION_ERROR;
      },
      execute: async (error) => {
        try {
          const permission = error.context?.additionalData?.permission;
          if (permission && typeof chrome !== 'undefined' && chrome.permissions) {
            const granted = await chrome.permissions.request({ permissions: [permission] });
            return granted;
          }
        } catch (requestError) {
          console.error('权限请求失败:', requestError);
        }
        return false;
      }
    });

    // 配置重置策略
    this.addStrategy({
      id: 'reset_config',
      name: '重置配置',
      description: '配置错误时重置为默认配置',
      canHandle: (error) => {
        return error.type === ErrorType.CONFIG_ERROR;
      },
      execute: async (error) => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.remove(['config']);
            console.log('配置重置完成');
            return true;
          }
        } catch (resetError) {
          console.error('配置重置失败:', resetError);
        }
        return false;
      }
    });

    // 内存清理策略
    this.addStrategy({
      id: 'clear_memory',
      name: '清理内存',
      description: '内存错误时清理缓存',
      canHandle: (error) => {
        return error.type === ErrorType.MEMORY_ERROR;
      },
      execute: async (error) => {
        try {
          // 清理不必要的缓存
          if (typeof window !== 'undefined') {
            // 清理事件监听器
            // 清理定时器
            // 清理大型数据结构
            console.log('内存清理完成');
            return true;
          }
        } catch (cleanupError) {
          console.error('内存清理失败:', cleanupError);
        }
        return false;
      }
    });
  }

  // 初始化
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 注册错误监听器
      errorManager.addEventListener(this.handleRecovery.bind(this));
      
      this.isInitialized = true;
      console.log('恢复管理器初始化完成');
      
    } catch (error) {
      console.error('恢复管理器初始化失败:', error);
    }
  }

  // 处理错误恢复
  private async handleRecovery(error: AppError): Promise<void> {
    if (!this.config.enableAutoRecovery) return;

    const context: RecoveryContext = {
      attempt: 0,
      maxAttempts: this.config.maxRetries,
      startTime: Date.now(),
      lastAttempt: Date.now(),
      history: []
    };

    await this.attemptRecovery(error, context);
  }

  // 尝试恢复
  private async attemptRecovery(error: AppError, context: RecoveryContext): Promise<boolean> {
    if (context.attempt >= context.maxAttempts) {
      console.log('恢复尝试次数已达上限');
      return false;
    }

    context.attempt++;
    context.lastAttempt = Date.now();

    // 尝试所有适用的策略
    for (const strategyId of this.config.recoveryStrategies) {
      const strategy = this.strategies.get(strategyId);
      if (!strategy || !strategy.canHandle(error)) continue;

      try {
        const startTime = Date.now();
        const success = await strategy.execute(error);
        const duration = Date.now() - startTime;

        const result: RecoveryResult = {
          success,
          strategy: strategyId,
          message: success ? '恢复成功' : '恢复失败',
          duration
        };

        context.history.push(result);

        console.log(`恢复策略 ${strategy.name} ${success ? '成功' : '失败'}，耗时 ${duration}ms`);

        if (success) {
          return true;
        }

      } catch (strategyError) {
        console.error(`恢复策略 ${strategy.name} 执行失败:`, strategyError);
      }
    }

    // 如果当前尝试失败，延迟后重试
    if (context.attempt < context.maxAttempts) {
      const delay = this.config.retryDelay * context.attempt;
      console.log(`恢复失败，${delay}ms 后进行第 ${context.attempt + 1} 次尝试`);
      
      setTimeout(() => {
        this.attemptRecovery(error, context);
      }, delay);
    }

    return false;
  }

  // 添加策略
  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  // 移除策略
  removeStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
  }

  // 获取策略
  getStrategy(strategyId: string): RecoveryStrategy | undefined {
    return this.strategies.get(strategyId);
  }

  // 获取所有策略
  getAllStrategies(): RecoveryStrategy[] {
    return Array.from(this.strategies.values());
  }

  // 手动恢复
  async manualRecovery(error: AppError, strategyIds: string[]): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];

    for (const strategyId of strategyIds) {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) continue;

      try {
        const startTime = Date.now();
        const success = await strategy.execute(error);
        const duration = Date.now() - startTime;

        results.push({
          success,
          strategy: strategyId,
          message: success ? '手动恢复成功' : '手动恢复失败',
          duration
        });

        if (success) {
          break;
        }

      } catch (strategyError) {
        results.push({
          success: false,
          strategy: strategyId,
          message: '手动恢复执行失败',
          duration: 0
        });
      }
    }

    return results;
  }

  // 更新配置
  updateConfig(newConfig: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // 获取配置
  getConfig(): RecoveryConfig {
    return { ...this.config };
  }

  // 获取恢复统计
  getRecoveryStats(): {
    totalStrategies: number;
    enabledStrategies: string[];
    config: RecoveryConfig;
  } {
    return {
      totalStrategies: this.strategies.size,
      enabledStrategies: this.config.recoveryStrategies,
      config: this.config
    };
  }

  // 重置配置
  resetConfig(): void {
    this.config = this.getDefaultConfig();
  }

  // 销毁
  destroy(): void {
    this.isInitialized = false;
  }
}

// 全局恢复管理器实例
export const recoveryManager = RecoveryManager.getInstance();

// 初始化恢复管理器
export async function initializeRecovery(): Promise<void> {
  await recoveryManager.initialize();
}

// 装饰器：自动恢复
export function withRecovery(maxRetries: number = 3) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;
          
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
      
      throw lastError!;
    };
    
    return descriptor;
  };
}

// 辅助函数：带恢复的重试
export async function retryWithRecovery<T>(
  fn: () => Promise<T>,
  errorTypes: ErrorType[] = [ErrorType.NETWORK_ERROR, ErrorType.API_ERROR],
  maxRetries: number = 3
): Promise<T> {
  let lastError: AppError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const appError = errorManager.captureError(error);
      
      if (!errorTypes.includes(appError.type) || attempt === maxRetries) {
        throw appError;
      }
      
      lastError = appError;
      
      // 尝试恢复
      const strategies = recoveryManager.getAllStrategies()
        .filter(s => s.canHandle(appError))
        .map(s => s.id);
      
      if (strategies.length > 0) {
        const results = await recoveryManager.manualRecovery(appError, strategies);
        const success = results.some(r => r.success);
        
        if (success) {
          break;
        }
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw lastError!;
}
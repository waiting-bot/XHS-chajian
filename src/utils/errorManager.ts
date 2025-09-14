// 错误捕获和管理系统

import { 
  AppError, 
  ErrorType, 
  ErrorLevel, 
  ErrorContext, 
  ErrorStats,
  RecoveryStrategy 
} from '../types/error';

// 错误处理器接口
export interface ErrorHandler {
  canHandle(error: AppError): boolean;
  handle(error: AppError): Promise<void>;
}

// 错误事件监听器
export type ErrorEventListener = (error: AppError) => void;

export class ErrorManager {
  private static instance: ErrorManager;
  private handlers: Map<string, ErrorHandler> = new Map();
  private listeners: ErrorEventListener[] = [];
  private errorQueue: AppError[] = [];
  private stats: ErrorStats = {
    totalErrors: 0,
    errorsByType: {} as Record<ErrorType, number>,
    errorsByLevel: {} as Record<ErrorLevel, number>,
    recentErrors: [],
    errorRate: 0,
    lastErrorTime: 0
  };
  private isProcessing = false;
  private maxRecentErrors = 100;
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  private constructor() {
    this.initializeGlobalErrorHandlers();
    this.initializeRecoveryStrategies();
  }

  static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  // 初始化全局错误处理器
  private initializeGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // 未捕获的Promise错误
      window.addEventListener('unhandledrejection', (event) => {
        const error = new AppError(
          ErrorType.SYSTEM_ERROR,
          ErrorLevel.ERROR,
          '未处理的Promise拒绝',
          { component: 'global' },
          { stack: event.reason?.stack }
        );
        this.handleError(error);
        event.preventDefault();
      });

      // 全局JavaScript错误
      window.addEventListener('error', (event) => {
        const error = new AppError(
          ErrorType.SYSTEM_ERROR,
          ErrorLevel.ERROR,
          event.message || '全局JavaScript错误',
          { component: 'global' },
          { 
            stack: event.error?.stack,
            line: event.lineno,
            column: event.colno,
            file: event.filename 
          }
        );
        this.handleError(error);
        event.preventDefault();
      });
    }
  }

  // 初始化恢复策略
  private initializeRecoveryStrategies(): void {
    this.addRecoveryStrategy({
      id: 'retry_network',
      name: '网络重试',
      description: '网络错误自动重试',
      canHandle: (error) => error.type === ErrorType.NETWORK_ERROR && error.retryable,
      execute: async (error) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      }
    });

    this.addRecoveryStrategy({
      id: 'reload_page',
      name: '页面重载',
      description: '页面错误时重新加载',
      canHandle: (error) => error.type === ErrorType.DOM_ERROR,
      execute: async (error) => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
        return true;
      }
    });

    this.addRecoveryStrategy({
      id: 'clear_storage',
      name: '清理存储',
      description: '存储错误时清理缓存',
      canHandle: (error) => error.type === ErrorType.STORAGE_ERROR,
      execute: async (error) => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.clear();
          }
          return true;
        } catch {
          return false;
        }
      }
    });
  }

  // 添加错误处理器
  addHandler(id: string, handler: ErrorHandler): void {
    this.handlers.set(id, handler);
  }

  // 移除错误处理器
  removeHandler(id: string): void {
    this.handlers.delete(id);
  }

  // 添加错误事件监听器
  addEventListener(listener: ErrorEventListener): void {
    this.listeners.push(listener);
  }

  // 移除错误事件监听器
  removeEventListener(listener: ErrorEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // 添加恢复策略
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.id, strategy);
  }

  // 捕获并处理错误
  async handleError(error: AppError): Promise<void> {
    try {
      // 更新统计信息
      this.updateStats(error);
      
      // 添加到队列
      this.errorQueue.push(error);
      
      // 限制队列长度
      if (this.errorQueue.length > this.maxRecentErrors) {
        this.errorQueue.shift();
      }
      
      // 通知监听器
      this.notifyListeners(error);
      
      // 尝试恢复
      await this.attemptRecovery(error);
      
      // 调用错误处理器
      await this.callHandlers(error);
      
    } catch (handlingError) {
      console.error('错误处理失败:', handlingError);
    }
  }

  // 捕获并包装原生错误
  captureError(
    error: Error | string,
    type: ErrorType = ErrorType.SYSTEM_ERROR,
    level: ErrorLevel = ErrorLevel.ERROR,
    context: Partial<ErrorContext> = {}
  ): AppError {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'object' ? error.stack : undefined;
    
    return new AppError(
      type,
      level,
      message,
      context,
      { stack }
    );
  }

  // 尝试错误恢复
  private async attemptRecovery(error: AppError): Promise<void> {
    for (const strategy of this.recoveryStrategies.values()) {
      if (strategy.canHandle(error)) {
        try {
          const success = await strategy.execute(error);
          if (success) {
            console.log(`错误恢复成功: ${strategy.name}`);
            break;
          }
        } catch (recoveryError) {
          console.error(`错误恢复失败: ${strategy.name}`, recoveryError);
        }
      }
    }
  }

  // 调用错误处理器
  private async callHandlers(error: AppError): Promise<void> {
    for (const handler of this.handlers.values()) {
      if (handler.canHandle(error)) {
        try {
          await handler.handle(error);
        } catch (handlerError) {
          console.error('错误处理器执行失败:', handlerError);
        }
      }
    }
  }

  // 通知监听器
  private notifyListeners(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('错误监听器执行失败:', listenerError);
      }
    });
  }

  // 更新统计信息
  private updateStats(error: AppError): void {
    this.stats.totalErrors++;
    this.stats.errorsByType[error.type] = (this.stats.errorsByType[error.type] || 0) + 1;
    this.stats.errorsByLevel[error.level] = (this.stats.errorsByLevel[error.level] || 0) + 1;
    
    // 添加到最近错误列表
    this.stats.recentErrors.unshift(error);
    if (this.stats.recentErrors.length > this.maxRecentErrors) {
      this.stats.recentErrors.pop();
    }
    
    this.stats.lastErrorTime = error.timestamp;
    
    // 计算错误率 (每小时错误数)
    const oneHourAgo = Date.now() - 3600000;
    const recentErrors = this.stats.recentErrors.filter(e => e.timestamp > oneHourAgo);
    this.stats.errorRate = recentErrors.length;
  }

  // 获取错误统计
  getErrorStats(): ErrorStats {
    return { ...this.stats };
  }

  // 获取最近的错误
  getRecentErrors(limit: number = 10): AppError[] {
    return this.errorQueue.slice(-limit);
  }

  // 清除错误历史
  clearErrorHistory(): void {
    this.errorQueue = [];
    this.stats = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      errorsByLevel: {} as Record<ErrorLevel, number>,
      recentErrors: [],
      errorRate: 0,
      lastErrorTime: 0
    };
  }

  // 包装函数以捕获错误
  wrapFunction<T extends any[], R>(
    fn: (...args: T) => R,
    context: Partial<ErrorContext> = {}
  ): (...args: T) => R {
    return (...args: T) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(this.captureError(error, ErrorType.SYSTEM_ERROR, ErrorLevel.ERROR, context));
        throw error;
      }
    };
  }

  // 包装异步函数以捕获错误
  wrapAsyncFunction<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: Partial<ErrorContext> = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.handleError(this.captureError(error, ErrorType.SYSTEM_ERROR, ErrorLevel.ERROR, context));
        throw error;
      }
    };
  }

  // 创建自动重试的异步函数
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError!;
  }
}

// 全局错误管理器实例
export const errorManager = ErrorManager.getInstance();

// 装饰器：自动错误捕获
export function catchError(
  errorType: ErrorType = ErrorType.SYSTEM_ERROR,
  errorLevel: ErrorLevel = ErrorLevel.ERROR
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const context = {
          component: target.constructor?.name || 'unknown',
          action: propertyKey
        };
        
        const appError = errorManager.captureError(error, errorType, errorLevel, context);
        await errorManager.handleError(appError);
        throw appError;
      }
    };
    
    return descriptor;
  };
}

// 辅助函数：安全的异步执行
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: Partial<ErrorContext> = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await errorManager.handleError(errorManager.captureError(error, ErrorType.SYSTEM_ERROR, ErrorLevel.WARNING, context));
    return fallback;
  }
}

// 辅助函数：安全的同步执行
export function safeSync<T>(
  fn: () => T,
  fallback: T,
  context: Partial<ErrorContext> = {}
): T {
  try {
    return fn();
  } catch (error) {
    errorManager.handleError(errorManager.captureError(error, ErrorType.SYSTEM_ERROR, ErrorLevel.WARNING, context));
    return fallback;
  }
}
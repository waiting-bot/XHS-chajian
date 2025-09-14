// 错误类型定义

// 错误严重级别
export enum ErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 错误类型
export enum ErrorType {
  // 网络相关
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  TIMEOUT_ERROR = 'timeout_error',
  
  // 数据处理相关
  DATA_PARSE_ERROR = 'data_parse_error',
  DATA_VALIDATION_ERROR = 'data_validation_error',
  DATA_PROCESSING_ERROR = 'data_processing_error',
  
  // 存储相关
  STORAGE_ERROR = 'storage_error',
  CONFIG_ERROR = 'config_error',
  
  // 文件处理相关
  FILE_PROCESSING_ERROR = 'file_processing_error',
  FILE_UPLOAD_ERROR = 'file_upload_error',
  FILE_SIZE_ERROR = 'file_size_error',
  
  // 浏览器相关
  PERMISSION_ERROR = 'permission_error',
  EXTENSION_ERROR = 'extension_error',
  DOM_ERROR = 'dom_error',
  
  // 用户相关
  USER_INPUT_ERROR = 'user_input_error',
  AUTH_ERROR = 'auth_error',
  
  // 系统相关
  SYSTEM_ERROR = 'system_error',
  MEMORY_ERROR = 'memory_error',
  PERFORMANCE_ERROR = 'performance_error'
}

// 错误上下文接口
export interface ErrorContext {
  timestamp: number;
  component?: string;
  action?: string;
  url?: string;
  userAgent?: string;
  environment?: string;
  version?: string;
  additionalData?: Record<string, any>;
}

// 错误详情接口
export interface ErrorDetail {
  message: string;
  stack?: string;
  code?: string;
  line?: number;
  column?: number;
  file?: string;
}

// 主错误类
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly level: ErrorLevel;
  public readonly context: ErrorContext;
  public readonly detail: ErrorDetail;
  public readonly errorId: string;
  public readonly retryable: boolean;
  public readonly timestamp: number;

  constructor(
    type: ErrorType,
    level: ErrorLevel,
    message: string,
    context: Partial<ErrorContext> = {},
    detail: Partial<ErrorDetail> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.level = level;
    this.timestamp = Date.now();
    this.errorId = this.generateErrorId();
    this.retryable = retryable;
    
    this.context = {
      timestamp: this.timestamp,
      url: window.location.href,
      userAgent: navigator.userAgent,
      environment: this.getEnvironment(),
      ...context
    };
    
    this.detail = {
      message,
      ...detail
    };
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEnvironment(): string {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return 'extension';
    }
    if (typeof window !== 'undefined') {
      return 'web';
    }
    return 'unknown';
  }

  toJSON(): object {
    return {
      errorId: this.errorId,
      type: this.type,
      level: this.level,
      message: this.message,
      context: this.context,
      detail: this.detail,
      retryable: this.retryable,
      timestamp: this.timestamp
    };
  }

  toString(): string {
    return `[${this.level.toUpperCase()}] ${this.type}: ${this.message}`;
  }
}

// 特定错误类型
export class NetworkError extends AppError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(ErrorType.NETWORK_ERROR, ErrorLevel.ERROR, message, context, {}, true);
    this.name = 'NetworkError';
  }
}

export class APIError extends AppError {
  constructor(message: string, statusCode: number, context: Partial<ErrorContext> = {}) {
    super(ErrorType.API_ERROR, ErrorLevel.ERROR, message, context, { code: statusCode.toString() }, statusCode >= 500);
    this.name = 'APIError';
  }
}

export class DataParseError extends AppError {
  constructor(message: string, rawData: any, context: Partial<ErrorContext> = {}) {
    super(ErrorType.DATA_PARSE_ERROR, ErrorLevel.ERROR, message, { 
      ...context, 
      additionalData: { ...context.additionalData, rawData } 
    });
    this.name = 'DataParseError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: any) {
    super(ErrorType.DATA_VALIDATION_ERROR, ErrorLevel.WARNING, message, {
      additionalData: { field, value }
    });
    this.name = 'ValidationError';
  }
}

export class StorageError extends AppError {
  constructor(message: string, operation: string, key?: string) {
    super(ErrorType.STORAGE_ERROR, ErrorLevel.ERROR, message, {
      action: operation,
      additionalData: { key }
    });
    this.name = 'StorageError';
  }
}

export class PermissionError extends AppError {
  constructor(message: string, permission: string) {
    super(ErrorType.PERMISSION_ERROR, ErrorLevel.ERROR, message, {
      additionalData: { permission }
    });
    this.name = 'PermissionError';
  }
}

export class ConfigError extends AppError {
  constructor(message: string, configKey?: string) {
    super(ErrorType.CONFIG_ERROR, ErrorLevel.ERROR, message, {
      additionalData: { configKey }
    });
    this.name = 'ConfigError';
  }
}

export class FileProcessingError extends AppError {
  constructor(message: string, fileName?: string, fileSize?: number) {
    super(ErrorType.FILE_PROCESSING_ERROR, ErrorLevel.ERROR, message, {
      additionalData: { fileName, fileSize }
    });
    this.name = 'FileProcessingError';
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(ErrorType.AUTH_ERROR, ErrorLevel.WARNING, message);
    this.name = 'AuthError';
  }
}

export class MemoryError extends AppError {
  constructor(message: string, usage?: number) {
    super(ErrorType.MEMORY_ERROR, ErrorLevel.CRITICAL, message, {
      additionalData: { memoryUsage: usage }
    });
    this.name = 'MemoryError';
  }
}

export class PerformanceError extends AppError {
  constructor(message: string, metric?: string, value?: number) {
    super(ErrorType.PERFORMANCE_ERROR, ErrorLevel.WARNING, message, {
      additionalData: { metric, value }
    });
    this.name = 'PerformanceError';
  }
}

// 错误恢复策略类型
export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  canHandle: (error: AppError) => boolean;
  execute: (error: AppError) => Promise<boolean>;
}

// 错误统计信息
export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsByLevel: Record<ErrorLevel, number>;
  recentErrors: AppError[];
  errorRate: number;
  lastErrorTime: number;
}
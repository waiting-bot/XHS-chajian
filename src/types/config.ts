// 配置数据模型定义

export interface FeishuConfig {
  id: string
  name: string
  appId: string
  appSecret?: string
  accessToken: string
  tableId: string
  baseUrl: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface FieldMapping {
  title: string
  author: string
  content: string
  tags: string
  images: string
  video: string
  likes: string
  collects: string
  comments: string
  url: string
  createTime: string
}

export interface TableDataConfig {
  fieldMapping: FieldMapping
  tableId: string
  autoUploadFiles: boolean
  maxFileSize: number
  allowedTypes: string[]
  enableBatchProcessing: boolean
  maxConcurrentUploads: number
}

export interface AppConfig {
  version: string
  language: 'zh-CN' | 'en-US'
  theme: 'light' | 'dark' | 'auto'
  autoBackup: boolean
  backupInterval: number // in hours
  maxBackups: number
  debugMode: boolean
  statistics: {
    totalProcessed: number
    successCount: number
    failureCount: number
    lastProcessedAt?: number
  }
}

export interface StorageConfig {
  feishuConfigs: FeishuConfig[]
  activeConfigId: string
  tableDataConfig: TableDataConfig
  appConfig: AppConfig
  encryption: {
    enabled: boolean
    algorithm: 'AES-256-GCM'
    keyVersion: number
  }
}

export interface BackupData {
  version: string
  timestamp: number
  checksum: string
  encrypted: boolean
  data: StorageConfig
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  details: {
    connectivity: boolean
    authentication: boolean
    permissions: boolean
    tableAccess: boolean
    responseTime: number
  }
  errors: string[]
  warnings: string[]
}

export interface FieldMappingSuggestion {
  sourceField: keyof FieldMapping
  targetField: string
  confidence: number
  reason: string
}

export interface EncryptionKey {
  algorithm: string
  keyData: string
  iv: string
  version: number
}

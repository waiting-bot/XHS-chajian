import { z } from 'zod';
import type { FeishuConfig, TableDataConfig, AppConfig, FieldMapping } from '../types/config';

// Feishu配置验证模式
const FeishuConfigSchema = z.object({
  id: z.string().min(1, '配置ID不能为空'),
  name: z.string().min(1, '配置名称不能为空'),
  appId: z.string().min(1, 'App ID不能为空'),
  appSecret: z.string().optional(),
  accessToken: z.string().min(1, 'Access Token不能为空'),
  tableId: z.string().min(1, '表格ID不能为空'),
  baseUrl: z.string().url('无效的URL格式'),
  isActive: z.boolean(),
  createdAt: z.number().min(0),
  updatedAt: z.number().min(0),
});

// 字段映射验证模式
const FieldMappingSchema = z.object({
  title: z.string().min(1, '标题字段不能为空'),
  author: z.string().min(1, '作者字段不能为空'),
  content: z.string().min(1, '正文字段不能为空'),
  tags: z.string().min(1, '标签字段不能为空'),
  images: z.string().min(1, '图片字段不能为空'),
  video: z.string().min(1, '视频字段不能为空'),
  likes: z.string().min(1, '点赞数字段不能为空'),
  collects: z.string().min(1, '收藏数字段不能为空'),
  comments: z.string().min(1, '评论数字段不能为空'),
  url: z.string().min(1, '链接字段不能为空'),
  createTime: z.string().min(1, '创建时间字段不能为空'),
});

// 表格数据配置验证模式
const TableDataConfigSchema = z.object({
  fieldMapping: FieldMappingSchema,
  tableId: z.string().min(1, '表格ID不能为空'),
  autoUploadFiles: z.boolean(),
  maxFileSize: z.number().min(1024, '最大文件大小不能小于1KB'),
  allowedTypes: z.array(z.string()).min(1, '至少需要支持一种文件类型'),
  enableBatchProcessing: z.boolean(),
  maxConcurrentUploads: z.number().min(1).max(10, '并发上传数应在1-10之间'),
});

// 应用配置验证模式
const AppConfigSchema = z.object({
  version: z.string().min(1, '版本号不能为空'),
  language: z.enum(['zh-CN', 'en-US']),
  theme: z.enum(['light', 'dark', 'auto']),
  autoBackup: z.boolean(),
  backupInterval: z.number().min(1).max(168, '备份间隔应在1-168小时之间'),
  maxBackups: z.number().min(1).max(50, '最大备份数应在1-50之间'),
  debugMode: z.boolean(),
  statistics: z.object({
    totalProcessed: z.number().min(0),
    successCount: z.number().min(0),
    failureCount: z.number().min(0),
    lastProcessedAt: z.number().optional(),
  }),
});

// 存储配置验证模式
export const StorageConfigSchema = z.object({
  feishuConfigs: z.array(FeishuConfigSchema).min(1, '至少需要一个飞书配置'),
  activeConfigId: z.string().min(1, '活动配置ID不能为空'),
  tableDataConfig: TableDataConfigSchema,
  appConfig: AppConfigSchema,
  encryption: z.object({
    enabled: z.boolean(),
    algorithm: z.enum(['AES-256-GCM']),
    keyVersion: z.number().min(0),
  }),
});

// Access Token验证模式
export const AccessTokenSchema = z.string()
  .min(10, 'Access Token过短')
  .regex(/^pat_[a-zA-Z0-9_-]+$/, 'Access Token格式不正确');

// 表格ID验证模式
export const TableIdSchema = z.string()
  .min(10, '表格ID过短')
  .regex(/^[a-zA-Z0-9_-]+$/, '表格ID格式不正确');

// 验证函数
export function validateFeishuConfig(config: unknown): { success: boolean; data?: FeishuConfig; errors: string[] } {
  try {
    const validatedConfig = FeishuConfigSchema.parse(config);
    return { success: true, data: validatedConfig, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['未知验证错误'] };
  }
}

export function validateTableDataConfig(config: unknown): { success: boolean; data?: TableDataConfig; errors: string[] } {
  try {
    const validatedConfig = TableDataConfigSchema.parse(config);
    return { success: true, data: validatedConfig, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['未知验证错误'] };
  }
}

export function validateAppConfig(config: unknown): { success: boolean; data?: AppConfig; errors: string[] } {
  try {
    const validatedConfig = AppConfigSchema.parse(config);
    return { success: true, data: validatedConfig, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['未知验证错误'] };
  }
}

export function validateAccessToken(token: string): { success: boolean; errors: string[] } {
  try {
    AccessTokenSchema.parse(token);
    return { success: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      return { success: false, errors };
    }
    return { success: false, errors: ['Access Token验证失败'] };
  }
}

export function validateTableId(tableId: string): { success: boolean; errors: string[] } {
  try {
    TableIdSchema.parse(tableId);
    return { success: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      return { success: false, errors };
    }
    return { success: false, errors: ['表格ID验证失败'] };
  }
}

// 验证并修复配置
export function validateAndFixFeishuConfig(config: any): FeishuConfig {
  const now = Date.now();
  
  return {
    id: config.id || `config_${now}`,
    name: config.name || '默认配置',
    appId: config.appId || '',
    appSecret: config.appSecret || '',
    accessToken: config.accessToken || '',
    tableId: config.tableId || '',
    baseUrl: config.baseUrl || 'https://open.feishu.cn',
    isActive: config.isActive ?? false,
    createdAt: config.createdAt || now,
    updatedAt: config.updatedAt || now,
  };
}

// 验证字段映射
export function validateFieldMapping(mapping: any): { success: boolean; data?: FieldMapping; errors: string[] } {
  try {
    const validatedMapping = FieldMappingSchema.parse(mapping);
    return { success: true, data: validatedMapping, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['字段映射验证失败'] };
  }
}
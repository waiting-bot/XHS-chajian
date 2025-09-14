import type { 
  FeishuConfig, 
  TableDataConfig, 
  AppConfig, 
  StorageConfig, 
  ValidationResult,
  ConnectionTestResult,
  FieldMappingSuggestion
} from '../types/config';
import { storageManager } from './storageManager';
import { encryptionManager } from './encryption';
import { 
  validateFeishuConfig, 
  validateTableDataConfig, 
  validateAppConfig,
  validateAccessToken,
  validateTableId,
  validateFieldMapping,
  validateAndFixFeishuConfig
} from './validation';

export class ConfigManager {
  private static readonly STORAGE_KEY = 'storageConfig';
  private configCache: StorageConfig | null = null;
  private listeners: Set<(config: StorageConfig) => void> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    // 不在构造函数中自动初始化，改为懒加载
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.loadConfig();
      
      // 监听配置变化
      storageManager.addListener(this.STORAGE_KEY, (event) => {
        if (event.newValue) {
          this.configCache = event.newValue as StorageConfig;
          this.notifyListeners();
        }
      });
      
      this.isInitialized = true;
      console.log('配置管理器初始化成功');
    } catch (error) {
      console.error('配置管理器初始化失败:', error);
      await this.initializeDefaultConfig();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async initializeDefaultConfig(): Promise<void> {
    // 确保加密管理器已初始化
    await encryptionManager.initialize();
    const defaultConfig: StorageConfig = {
      feishuConfigs: [{
        id: 'default',
        name: '默认配置',
        appId: '',
        appSecret: '',
        accessToken: '',
        tableId: '',
        baseUrl: 'https://open.feishu.cn',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }],
      activeConfigId: 'default',
      tableDataConfig: {
        fieldMapping: {
          title: '标题',
          author: '作者',
          content: '正文',
          tags: '标签',
          images: '图片',
          video: '视频',
          likes: '点赞数',
          collects: '收藏数',
          comments: '评论数',
          url: '链接',
          createTime: '创建时间'
        },
        tableId: '',
        autoUploadFiles: true,
        maxFileSize: 10 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
        enableBatchProcessing: true,
        maxConcurrentUploads: 3
      },
      appConfig: {
        version: '1.0.0',
        language: 'zh-CN',
        theme: 'auto',
        autoBackup: true,
        backupInterval: 24,
        maxBackups: 5,
        debugMode: false,
        statistics: {
          totalProcessed: 0,
          successCount: 0,
          failureCount: 0
        }
      },
      encryption: {
        enabled: await encryptionManager.isEncryptionEnabled(),
        algorithm: 'AES-256-GCM',
        keyVersion: await encryptionManager.getKeyVersion()
      }
    };

    await this.saveConfig(defaultConfig);
    this.configCache = defaultConfig;
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await storageManager.get<StorageConfig>(this.STORAGE_KEY);
      if (config) {
        // 验证并修复配置
        this.configCache = await this.validateAndFixConfig(config);
      } else {
        await this.initializeDefaultConfig();
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      await this.initializeDefaultConfig();
    }
  }

  private async saveConfig(config: StorageConfig): Promise<void> {
    try {
      // 加密敏感字段
      const encryptedConfig = await encryptionManager.encryptSensitiveFields(config);
      
      // 保存到存储
      await storageManager.set(this.STORAGE_KEY, encryptedConfig, { encrypt: true });
      
      // 更新缓存
      this.configCache = config;
      
      // 通知监听器
      this.notifyListeners();
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  }

  private async validateAndFixConfig(config: any): Promise<StorageConfig> {
    // 确保加密管理器已初始化
    await encryptionManager.initialize();
    try {
      const fixedConfig: StorageConfig = {
        feishuConfigs: Array.isArray(config.feishuConfigs) 
          ? config.feishuConfigs.map((c: any) => validateAndFixFeishuConfig(c))
          : [],
        activeConfigId: config.activeConfigId || 'default',
        tableDataConfig: {
          fieldMapping: config.tableDataConfig?.fieldMapping || {
            title: '标题',
            author: '作者',
            content: '正文',
            tags: '标签',
            images: '图片',
            video: '视频',
            likes: '点赞数',
            collects: '收藏数',
            comments: '评论数',
            url: '链接',
            createTime: '创建时间'
          },
          tableId: config.tableDataConfig?.tableId || '',
          autoUploadFiles: config.tableDataConfig?.autoUploadFiles ?? true,
          maxFileSize: config.tableDataConfig?.maxFileSize || 10 * 1024 * 1024,
          allowedTypes: config.tableDataConfig?.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
          enableBatchProcessing: config.tableDataConfig?.enableBatchProcessing ?? true,
          maxConcurrentUploads: config.tableDataConfig?.maxConcurrentUploads || 3
        },
        appConfig: {
          version: config.appConfig?.version || '1.0.0',
          language: config.appConfig?.language || 'zh-CN',
          theme: config.appConfig?.theme || 'auto',
          autoBackup: config.appConfig?.autoBackup ?? true,
          backupInterval: config.appConfig?.backupInterval || 24,
          maxBackups: config.appConfig?.maxBackups || 5,
          debugMode: config.appConfig?.debugMode ?? false,
          statistics: {
            totalProcessed: config.appConfig?.statistics?.totalProcessed || 0,
            successCount: config.appConfig?.statistics?.successCount || 0,
            failureCount: config.appConfig?.statistics?.failureCount || 0,
            lastProcessedAt: config.appConfig?.statistics?.lastProcessedAt
          }
        },
        encryption: {
          enabled: await encryptionManager.isEncryptionEnabled(),
          algorithm: 'AES-256-GCM',
          keyVersion: await encryptionManager.getKeyVersion()
        }
      };

      // 确保至少有一个配置
      if (fixedConfig.feishuConfigs.length === 0) {
        fixedConfig.feishuConfigs.push({
          id: 'default',
          name: '默认配置',
          appId: '',
          appSecret: '',
          accessToken: '',
          tableId: '',
          baseUrl: 'https://open.feishu.cn',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      // 确保活动配置存在
      if (!fixedConfig.feishuConfigs.find(c => c.id === fixedConfig.activeConfigId)) {
        fixedConfig.activeConfigId = fixedConfig.feishuConfigs[0].id;
      }

      return fixedConfig;
    } catch (error) {
      console.error('验证并修复配置失败:', error);
      throw error;
    }
  }

  private notifyListeners(): void {
    if (this.configCache) {
      this.listeners.forEach(listener => {
        try {
          listener(this.configCache!);
        } catch (error) {
          console.error('配置监听器执行失败:', error);
        }
      });
    }
  }

  // 获取配置
  async getConfig(): Promise<StorageConfig> {
    await this.ensureInitialized();
    
    if (!this.configCache) {
      await this.loadConfig();
    }
    return this.configCache!;
  }

  // 获取当前活动配置
  async getActiveConfig(): Promise<FeishuConfig | null> {
    const config = await this.getConfig();
    return config.feishuConfigs.find(c => c.id === config.activeConfigId) || null;
  }

  // 获取表格数据配置
  async getTableDataConfig(): Promise<TableDataConfig> {
    const config = await this.getConfig();
    return config.tableDataConfig;
  }

  // 获取应用配置
  async getAppConfig(): Promise<AppConfig> {
    const config = await this.getConfig();
    return config.appConfig;
  }

  // 创建飞书配置
  async createFeishuConfig(config: Partial<FeishuConfig>): Promise<FeishuConfig> {
    const fullConfig: FeishuConfig = {
      id: config.id || `config_${Date.now()}`,
      name: config.name || '新配置',
      appId: config.appId || '',
      appSecret: config.appSecret || '',
      accessToken: config.accessToken || '',
      tableId: config.tableId || '',
      baseUrl: config.baseUrl || 'https://open.feishu.cn',
      isActive: config.isActive ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const validation = validateFeishuConfig(fullConfig);
    if (!validation.success) {
      throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
    }

    const storageConfig = await this.getConfig();
    storageConfig.feishuConfigs.push(fullConfig);
    
    await this.saveConfig(storageConfig);
    return fullConfig;
  }

  // 更新飞书配置
  async updateFeishuConfig(id: string, updates: Partial<FeishuConfig>): Promise<FeishuConfig> {
    const storageConfig = await this.getConfig();
    const configIndex = storageConfig.feishuConfigs.findIndex(c => c.id === id);
    
    if (configIndex === -1) {
      throw new Error('配置不存在');
    }

    const updatedConfig = {
      ...storageConfig.feishuConfigs[configIndex],
      ...updates,
      updatedAt: Date.now()
    };

    const validation = validateFeishuConfig(updatedConfig);
    if (!validation.success) {
      throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
    }

    storageConfig.feishuConfigs[configIndex] = updatedConfig;
    await this.saveConfig(storageConfig);
    
    return updatedConfig;
  }

  // 删除飞书配置
  async deleteFeishuConfig(id: string): Promise<void> {
    const storageConfig = await this.getConfig();
    const configIndex = storageConfig.feishuConfigs.findIndex(c => c.id === id);
    
    if (configIndex === -1) {
      throw new Error('配置不存在');
    }

    storageConfig.feishuConfigs.splice(configIndex, 1);
    
    // 如果删除的是活动配置，切换到第一个配置
    if (storageConfig.activeConfigId === id && storageConfig.feishuConfigs.length > 0) {
      storageConfig.activeConfigId = storageConfig.feishuConfigs[0].id;
    }

    await this.saveConfig(storageConfig);
  }

  // 设置活动配置
  async setActiveConfig(id: string): Promise<void> {
    const storageConfig = await this.getConfig();
    const config = storageConfig.feishuConfigs.find(c => c.id === id);
    
    if (!config) {
      throw new Error('配置不存在');
    }

    // 禁用所有配置，启用指定配置
    storageConfig.feishuConfigs.forEach(c => {
      c.isActive = c.id === id;
    });
    storageConfig.activeConfigId = id;

    await this.saveConfig(storageConfig);
  }

  // 更新表格数据配置
  async updateTableDataConfig(updates: Partial<TableDataConfig>): Promise<TableDataConfig> {
    const storageConfig = await this.getConfig();
    const updatedConfig = {
      ...storageConfig.tableDataConfig,
      ...updates
    };

    const validation = validateTableDataConfig(updatedConfig);
    if (!validation.success) {
      throw new Error(`表格数据配置验证失败: ${validation.errors.join(', ')}`);
    }

    storageConfig.tableDataConfig = updatedConfig;
    await this.saveConfig(storageConfig);
    
    return updatedConfig;
  }

  // 更新应用配置
  async updateAppConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    const storageConfig = await this.getConfig();
    const updatedConfig = {
      ...storageConfig.appConfig,
      ...updates
    };

    const validation = validateAppConfig(updatedConfig);
    if (!validation.success) {
      throw new Error(`应用配置验证失败: ${validation.errors.join(', ')}`);
    }

    storageConfig.appConfig = updatedConfig;
    await this.saveConfig(storageConfig);
    
    return updatedConfig;
  }

  // 验证配置
  async validateConfig(): Promise<ValidationResult> {
    try {
      const config = await this.getConfig();
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // 验证飞书配置
      const activeConfig = config.feishuConfigs.find(c => c.id === config.activeConfigId);
      if (activeConfig) {
        const feishuValidation = validateFeishuConfig(activeConfig);
        if (!feishuValidation.success) {
          errors.push(...feishuValidation.errors);
        }

        // 验证Access Token
        const tokenValidation = validateAccessToken(activeConfig.accessToken);
        if (!tokenValidation.success) {
          warnings.push(...tokenValidation.errors);
        }

        // 验证表格ID
        const tableIdValidation = validateTableId(activeConfig.tableId);
        if (!tableIdValidation.success) {
          warnings.push(...tableIdValidation.errors);
        }
      } else {
        errors.push('没有活动配置');
      }

      // 验证表格数据配置
      const tableDataValidation = validateTableDataConfig(config.tableDataConfig);
      if (!tableDataValidation.success) {
        errors.push(...tableDataValidation.errors);
      }

      // 验证应用配置
      const appConfigValidation = validateAppConfig(config.appConfig);
      if (!appConfigValidation.success) {
        errors.push(...appConfigValidation.errors);
      }

      // 检查存储使用情况
      const stats = await storageManager.getStats();
      if (stats.usagePercent > 80) {
        warnings.push('存储使用量超过80%，建议清理旧数据');
      }

      // 检查是否需要备份
      if (config.appConfig.autoBackup) {
        const lastBackup = await this.getLastBackupTime();
        const backupInterval = config.appConfig.backupInterval * 60 * 60 * 1000;
        if (Date.now() - lastBackup > backupInterval) {
          suggestions.push('建议创建数据备份');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : '配置验证失败'],
        warnings: [],
        suggestions: []
      };
    }
  }

  // 导入配置
  async importConfig(configJson: string, password?: string): Promise<boolean> {
    try {
      let importedConfig: StorageConfig;
      
      if (password) {
        // 解密导入的配置
        const decrypted = await encryptionManager.decrypt(configJson);
        importedConfig = JSON.parse(decrypted);
      } else {
        importedConfig = JSON.parse(configJson);
      }

      // 验证导入的配置
      const validation = await this.validateAndFixConfig(importedConfig);
      
      // 保存导入的配置
      await this.saveConfig(validation);
      
      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      return false;
    }
  }

  // 导出配置
  async exportConfig(password?: string): Promise<string> {
    try {
      const config = await this.getConfig();
      const configJson = JSON.stringify(config, null, 2);
      
      if (password) {
        // 加密导出的配置
        return await encryptionManager.encrypt(configJson);
      }
      
      return configJson;
    } catch (error) {
      console.error('导出配置失败:', error);
      throw error;
    }
  }

  // 获取所有配置
  async getAllFeishuConfigs(): Promise<FeishuConfig[]> {
    const config = await this.getConfig();
    return config.feishuConfigs;
  }

  // 监听配置变化
  addListener(listener: (config: StorageConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 移除监听器
  removeListener(listener: (config: StorageConfig) => void): void {
    this.listeners.delete(listener);
  }

  // 获取最后备份时间
  private async getLastBackupTime(): Promise<number> {
    try {
      const backups = await storageManager.getBackups();
      return backups.length > 0 ? backups[0].timestamp : 0;
    } catch (error) {
      console.error('获取最后备份时间失败:', error);
      return 0;
    }
  }

  // 更新统计信息
  async updateStatistics(success: boolean): Promise<void> {
    try {
      const config = await this.getConfig();
      config.appConfig.statistics.totalProcessed++;
      
      if (success) {
        config.appConfig.statistics.successCount++;
        config.appConfig.statistics.lastProcessedAt = Date.now();
      } else {
        config.appConfig.statistics.failureCount++;
      }

      await this.saveConfig(config);
    } catch (error) {
      console.error('更新统计信息失败:', error);
    }
  }
}

// 导出单例实例
export const configManager = new ConfigManager();
export default ConfigManager;
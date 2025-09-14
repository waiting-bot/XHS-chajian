import { DataProcessor, BatchProcessor } from '../utils/dataProcessor';
import { fileProcessor } from '../utils/fileProcessor';
import { configManager } from '../utils/configManager';
import { connectionTester } from '../utils/connectionTester';
import { FeishuClient } from '../api/feishu';
import { storageManager } from '../utils/storageManager';
import { encryptionManager } from '../utils/encryption';

// 延迟初始化组件
let dataProcessor: DataProcessor | null = null;
let batchProcessor: BatchProcessor | null = null;

// 安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('小红书笔记采集器已安装');
  initializeExtension();
});

// 启动事件
chrome.runtime.onStartup.addListener(() => {
  console.log('小红书笔记采集器已启动');
  initializeExtension();
});

// 检查扩展是否已初始化
function isExtensionInitialized(): boolean {
  return dataProcessor !== null && batchProcessor !== null;
}

// 确保扩展已初始化
async function ensureExtensionInitialized(): Promise<void> {
  if (!isExtensionInitialized()) {
    console.log('扩展未初始化，开始初始化...');
    await initializeExtension();
    
    // 再次检查是否成功初始化
    if (!isExtensionInitialized()) {
      throw new Error('扩展初始化失败，无法处理请求');
    }
  }
}

// 综合健康检查
async function performHealthCheck(): Promise<{ allHealthy: boolean; results: any[] }> {
  console.log('开始系统健康检查...');
  
  const results = [];
  
  try {
    // 检查存储管理器
    const storageHealth = await storageManager.healthCheck();
    results.push({ component: 'StorageManager', ...storageHealth });
    
    // 检查加密管理器
    const encryptionHealth = await encryptionManager.healthCheck();
    results.push({ component: 'EncryptionManager', ...encryptionHealth });
    
    // 检查配置管理器
    const configHealth = await configManager.getConfig().then(() => ({ healthy: true, issues: [] })).catch(error => ({
      healthy: false, issues: [error.message]
    }));
    results.push({ component: 'ConfigManager', ...configHealth });
    
    // 检查数据处理器
    const processorHealthy = dataProcessor !== null && batchProcessor !== null;
    results.push({
      component: 'DataProcessor',
      healthy: processorHealthy,
      issues: processorHealthy ? [] : ['数据处理器未初始化']
    });
    
    const allHealthy = results.every(r => r.healthy);
    
    if (allHealthy) {
      console.log('✅ 系统健康检查通过');
    } else {
      console.warn('⚠️ 系统健康检查发现问题:');
      results.forEach(result => {
        if (!result.healthy) {
          console.warn(`  - ${result.component}: ${result.issues.join(', ')}`);
        }
      });
    }
    
    return { allHealthy, results };
  } catch (error) {
    console.error('健康检查执行失败:', error);
    return { 
      allHealthy: false, 
      results: [{ component: 'HealthCheck', healthy: false, issues: [error.message] }] 
    };
  }
}

// 初始化扩展
async function initializeExtension() {
  const maxRetries = 3;
  const retryDelay = 1000; // 1秒
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`开始初始化扩展组件 (尝试 ${attempt}/${maxRetries})...`);
      
      // 检查 Chrome API 是否可用
      if (!chrome || !chrome.runtime || !chrome.storage) {
        throw new Error('Chrome API 不可用，扩展无法正常初始化');
      }
      
      // 等待更长时间确保 Chrome 完全就绪
      await new Promise(resolve => setTimeout(resolve, attempt * 200));
      
      // 1. 首先初始化存储管理器
      console.log('初始化存储管理器...');
      await storageManager.initialize();
      
      // 2. 初始化加密管理器
      console.log('初始化加密管理器...');
      await encryptionManager.initialize();
      
      // 3. 初始化配置管理器
      console.log('初始化配置管理器...');
      await configManager.initialize();
      
      // 4. 初始化数据处理器
      console.log('初始化数据处理器...');
      dataProcessor = new DataProcessor();
      batchProcessor = new BatchProcessor(dataProcessor);
      
      // 5. 测试配置是否正常加载
      const config = await configManager.getConfig();
      console.log('配置加载成功，包含', config.feishuConfigs.length, '个飞书配置');
      
      // 6. 执行健康检查
      const healthCheck = await performHealthCheck();
      if (!healthCheck.allHealthy) {
        console.warn('初始化完成但健康检查发现问题');
        // 如果健康检查失败，尝试重新初始化关键组件
        if (attempt < maxRetries) {
          console.log('尝试重新初始化关键组件...');
          continue;
        }
      }
      
      console.log('✅ 扩展初始化完成');
      return; // 成功初始化，退出重试循环
      
    } catch (error) {
      console.error(`扩展初始化失败 (尝试 ${attempt}/${maxRetries}):`, error);
      
      if (attempt === maxRetries) {
        // 最后一次尝试失败，进入恢复模式
        console.error('所有初始化尝试均失败，进入恢复模式...');
        await initializeRecoveryMode();
        return;
      }
      
      // 等待后重试
      console.log(`等待 ${retryDelay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// 恢复模式初始化
async function initializeRecoveryMode() {
  try {
    console.log('开始恢复模式初始化...');
    
    // 检查最基本的 Chrome API
    if (!chrome || !chrome.storage) {
      console.error('Chrome API 不可用，恢复模式失败');
      return;
    }
    
    // 只初始化最基本的存储功能
    console.log('恢复模式：初始化基本存储功能...');
    try {
      await storageManager.initialize();
      console.log('✅ 恢复模式：存储管理器初始化成功');
    } catch (storageError) {
      console.error('恢复模式：存储管理器初始化失败', storageError);
    }
    
    // 尝试初始化加密管理器
    try {
      await encryptionManager.initialize();
      console.log('✅ 恢复模式：加密管理器初始化成功');
    } catch (encryptionError) {
      console.error('恢复模式：加密管理器初始化失败', encryptionError);
    }
    
    console.log('⚠️ 恢复模式初始化完成，部分功能可能不可用');
    
  } catch (error) {
    console.error('恢复模式初始化完全失败:', error);
  }
}

// 消息处理
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    // 首先检查基本的消息格式
    if (!message || !message.type) {
      sendResponse({ success: false, error: '无效的消息格式' });
      return;
    }
    
    // 确保扩展已初始化
    await ensureExtensionInitialized();
    
    switch (message.type) {
    case 'PROCESS_NOTE_DATA':
      handleProcessNoteData(message.data, sender).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

  case 'BATCH_PROCESS_DATA':
    handleBatchProcessData(message.dataList).then(results => {
      sendResponse({ success: true, results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'UPDATE_FEISHU_CONFIG':
    handleUpdateFeishuConfig(message.config).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'TEST_FEISHU_CONNECTION':
    handleTestFeishuConnection().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'GET_FEISHU_FIELDS':
    handleGetFeishuFields(message.tableId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'UPDATE_FIELD_MAPPING':
    handleUpdateFieldMapping(message.mapping).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'VALIDATE_CONFIG':
    handleValidateConfig().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'CREATE_CONFIG':
    handleCreateConfig(message.config).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'UPDATE_CONFIG':
    handleUpdateConfig(message.id, message.updates).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'DELETE_CONFIG':
    handleDeleteConfig(message.id).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'SET_ACTIVE_CONFIG':
    handleSetActiveConfig(message.id).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'EXPORT_CONFIG':
    handleExportConfig(message.password).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'IMPORT_CONFIG':
    handleImportConfig(message.configJson, message.password).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'DETECT_FIELD_MAPPING':
    handleDetectFieldMapping(message.tableId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'GET_PROCESSING_STATS':
    handleGetProcessingStats().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'PROCESS_FILES':
    handleProcessFiles(message.urls).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  case 'HEALTH_CHECK':
    performHealthCheck().then(result => {
      sendResponse({ success: true, ...result });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;

  default:
    sendResponse({ success: false, error: '未知的消息类型' });
  }
  } catch (error) {
    console.error('消息处理失败:', error);
    
    // 提供更具体的错误信息
    let errorMessage = error.message;
    if (error.message.includes('扩展初始化失败')) {
      errorMessage = '扩展正在初始化中，请稍后再试';
    } else if (error.message.includes('Chrome API 不可用')) {
      errorMessage = '浏览器API不可用，请刷新页面或重启扩展';
    }
    
    sendResponse({ success: false, error: errorMessage });
  }
});

// 处理笔记数据
async function handleProcessNoteData(data: any, sender: chrome.runtime.MessageSender) {
  try {
    if (!sender.tab?.url) {
      throw new Error('无法获取页面URL');
    }

    if (!dataProcessor || !batchProcessor) {
      throw new Error('数据处理器未初始化');
    }

    const { noteData, files } = data;
    
    // 验证数据
    const validation = await dataProcessor.validateData(noteData);
    if (!validation.valid) {
      throw new Error(`数据验证失败: ${validation.errors.join(', ')}`);
    }

    // 处理数据
    const result = await dataProcessor.processData(noteData, files);
    
    // 更新统计
    await dataProcessor.updateProcessingStats(result);

    return result;
  } catch (error) {
    console.error('处理笔记数据失败:', error);
    throw error;
  }
}

// 批量处理数据
async function handleBatchProcessData(dataList: any[]) {
  try {
    const results = await batchProcessor.processQueue();
    return { success: true, results };
  } catch (error) {
    console.error('批量处理数据失败:', error);
    throw error;
  }
}

// 更新飞书配置
async function handleUpdateFeishuConfig(config: any) {
  try {
    const activeConfig = await configManager.getActiveConfig();
    if (activeConfig) {
      await configManager.updateFeishuConfig(activeConfig.id, config);
    }
    return { success: true };
  } catch (error) {
    console.error('更新飞书配置失败:', error);
    throw error;
  }
}

// 测试飞书连接
async function handleTestFeishuConnection() {
  try {
    const activeConfig = await configManager.getActiveConfig();
    if (!activeConfig) {
      throw new Error('没有可用的飞书配置');
    }
    
    const result = await connectionTester.testConnection(activeConfig);
    return result;
  } catch (error) {
    console.error('测试飞书连接失败:', error);
    throw error;
  }
}

// 获取飞书表格字段
async function handleGetFeishuFields(tableId?: string) {
  try {
    const activeConfig = await configManager.getActiveConfig();
    if (!activeConfig) {
      throw new Error('没有可用的飞书配置');
    }
    
    const feishuClient = new FeishuClient(activeConfig);
    const fields = await feishuClient.getTableFields(tableId);
    return { success: true, fields };
  } catch (error) {
    console.error('获取飞书表格字段失败:', error);
    throw error;
  }
}

// 更新字段映射
async function handleUpdateFieldMapping(mapping: any) {
  try {
    await dataProcessor.updateFieldMapping(mapping);
    return { success: true };
  } catch (error) {
    console.error('更新字段映射失败:', error);
    throw error;
  }
}

// 验证配置
async function handleValidateConfig() {
  try {
    const result = await configManager.validateConfig();
    return result;
  } catch (error) {
    console.error('验证配置失败:', error);
    throw error;
  }
}

// 创建配置
async function handleCreateConfig(config: any) {
  try {
    const result = await configManager.createFeishuConfig(config);
    return { success: true, data: result };
  } catch (error) {
    console.error('创建配置失败:', error);
    throw error;
  }
}

// 更新配置
async function handleUpdateConfig(id: string, updates: any) {
  try {
    const result = await configManager.updateFeishuConfig(id, updates);
    return { success: true, data: result };
  } catch (error) {
    console.error('更新配置失败:', error);
    throw error;
  }
}

// 删除配置
async function handleDeleteConfig(id: string) {
  try {
    await configManager.deleteFeishuConfig(id);
    return { success: true };
  } catch (error) {
    console.error('删除配置失败:', error);
    throw error;
  }
}

// 设置活动配置
async function handleSetActiveConfig(id: string) {
  try {
    await configManager.setActiveConfig(id);
    return { success: true };
  } catch (error) {
    console.error('设置活动配置失败:', error);
    throw error;
  }
}

// 导出配置
async function handleExportConfig(password?: string) {
  try {
    const result = await configManager.exportConfig(password);
    return { success: true, data: result };
  } catch (error) {
    console.error('导出配置失败:', error);
    throw error;
  }
}

// 导入配置
async function handleImportConfig(configJson: string, password?: string) {
  try {
    const result = await configManager.importConfig(configJson, password);
    return { success: true, data: result };
  } catch (error) {
    console.error('导入配置失败:', error);
    throw error;
  }
}

// 检测字段映射
async function handleDetectFieldMapping(tableId: string) {
  try {
    const activeConfig = await configManager.getActiveConfig();
    if (!activeConfig) {
      throw new Error('没有可用的飞书配置');
    }
    
    const suggestions = await connectionTester.detectFieldMapping(tableId, activeConfig.baseUrl);
    return { success: true, data: suggestions };
  } catch (error) {
    console.error('检测字段映射失败:', error);
    throw error;
  }
}

// 获取处理统计
async function handleGetProcessingStats() {
  try {
    const stats = await dataProcessor.getProcessingStatistics();
    return { success: true, stats };
  } catch (error) {
    console.error('获取处理统计失败:', error);
    throw error;
  }
}

// 处理文件
async function handleProcessFiles(urls: string[]) {
  try {
    const files = await fileProcessor.processFiles(urls);
    return { success: true, files };
  } catch (error) {
    console.error('处理文件失败:', error);
    throw error;
  }
}

// 导出配置 (deprecated)
async function handleExportConfigLegacy() {
  try {
    const config = await dataProcessor.exportConfig();
    return { success: true, config };
  } catch (error) {
    console.error('导出配置失败:', error);
    throw error;
  }
}

// 导入配置 (deprecated)
async function handleImportConfigLegacy(configJson: string) {
  try {
    const result = await dataProcessor.importConfig(configJson);
    return { success: result };
  } catch (error) {
    console.error('导入配置失败:', error);
    throw error;
  }
}

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    Object.keys(changes).forEach(key => {
      if (key === 'storageConfig') {
        console.log('存储配置已更新');
      }
    });
  }
});

// 错误处理
if (typeof process !== 'undefined') {
  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
  });
}
import { FeishuClient } from '../api/feishu'
import { DataProcessor, BatchProcessor } from '../utils/dataProcessor'
import { fileProcessor } from '../utils/fileProcessor'

// 初始化客户端
const feishuClient = new FeishuClient({})
const dataProcessor = new DataProcessor(feishuClient)
const batchProcessor = new BatchProcessor(dataProcessor)

// 安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('小红书笔记采集器已安装')
  initializeExtension()
})

// 启动事件
chrome.runtime.onStartup.addListener(() => {
  console.log('小红书笔记采集器已启动')
  initializeExtension()
})

// 初始化扩展
async function initializeExtension() {
  try {
    await feishuClient.loadConfig()
    console.log('扩展初始化完成')
  } catch (error) {
    console.error('扩展初始化失败:', error)
  }
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'PROCESS_NOTE_DATA':
      handleProcessNoteData(message.data, sender).then(result => {
        sendResponse(result)
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'BATCH_PROCESS_DATA':
      handleBatchProcessData(message.dataList).then(results => {
        sendResponse({ success: true, results })
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'UPDATE_FEISHU_CONFIG':
      handleUpdateFeishuConfig(message.config).then(() => {
        sendResponse({ success: true })
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'TEST_FEISHU_CONNECTION':
      handleTestFeishuConnection().then(result => {
        sendResponse(result)
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'GET_FEISHU_FIELDS':
      handleGetFeishuFields(message.tableId).then(result => {
        sendResponse(result)
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'UPDATE_FIELD_MAPPING':
      handleUpdateFieldMapping(message.mapping).then(() => {
        sendResponse({ success: true })
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'GET_PROCESSING_STATS':
      handleGetProcessingStats().then(result => {
        sendResponse(result)
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'PROCESS_FILES':
      handleProcessFiles(message.urls).then(result => {
        sendResponse(result)
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'EXPORT_CONFIG':
      handleExportConfig().then(result => {
        sendResponse(result)
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    case 'IMPORT_CONFIG':
      handleImportConfig(message.configJson).then(result => {
        sendResponse(result)
      }).catch(error => {
        sendResponse({ success: false, error: error.message })
      })
      return true

    default:
      sendResponse({ success: false, error: '未知的消息类型' })
  }
})

// 处理笔记数据
async function handleProcessNoteData(data: any, sender: chrome.runtime.MessageSender) {
  try {
    if (!sender.tab?.url) {
      throw new Error('无法获取页面URL')
    }

    const { noteData, files } = data
    
    // 验证数据
    const validation = await dataProcessor.validateData(noteData)
    if (!validation.valid) {
      throw new Error(`数据验证失败: ${validation.errors.join(', ')}`)
    }

    // 处理数据
    const result = await dataProcessor.processData(noteData, files)
    
    // 更新统计
    await dataProcessor.updateProcessingStats(result)

    return result
  } catch (error) {
    console.error('处理笔记数据失败:', error)
    throw error
  }
}

// 批量处理数据
async function handleBatchProcessData(dataList: any[]) {
  try {
    const results = await batchProcessor.processQueue()
    return { success: true, results }
  } catch (error) {
    console.error('批量处理数据失败:', error)
    throw error
  }
}

// 更新飞书配置
async function handleUpdateFeishuConfig(config: any) {
  try {
    await feishuClient.updateConfig(config)
    return { success: true }
  } catch (error) {
    console.error('更新飞书配置失败:', error)
    throw error
  }
}

// 测试飞书连接
async function handleTestFeishuConnection() {
  try {
    const result = await feishuClient.testConnection()
    return { success: result }
  } catch (error) {
    console.error('测试飞书连接失败:', error)
    throw error
  }
}

// 获取飞书表格字段
async function handleGetFeishuFields(tableId?: string) {
  try {
    const fields = await feishuClient.getTableFields(tableId)
    return { success: true, fields }
  } catch (error) {
    console.error('获取飞书表格字段失败:', error)
    throw error
  }
}

// 更新字段映射
async function handleUpdateFieldMapping(mapping: any) {
  try {
    await dataProcessor.updateFieldMapping(mapping)
    return { success: true }
  } catch (error) {
    console.error('更新字段映射失败:', error)
    throw error
  }
}

// 获取处理统计
async function handleGetProcessingStats() {
  try {
    const stats = await dataProcessor.getProcessingStatistics()
    return { success: true, stats }
  } catch (error) {
    console.error('获取处理统计失败:', error)
    throw error
  }
}

// 处理文件
async function handleProcessFiles(urls: string[]) {
  try {
    const files = await fileProcessor.processFiles(urls)
    return { success: true, files }
  } catch (error) {
    console.error('处理文件失败:', error)
    throw error
  }
}

// 导出配置
async function handleExportConfig() {
  try {
    const config = await dataProcessor.exportConfig()
    return { success: true, config }
  } catch (error) {
    console.error('导出配置失败:', error)
    throw error
  }
}

// 导入配置
async function handleImportConfig(configJson: string) {
  try {
    const result = await dataProcessor.importConfig(configJson)
    return { success: result }
  } catch (error) {
    console.error('导入配置失败:', error)
    throw error
  }
}

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    Object.keys(changes).forEach(key => {
      if (key === 'feishuConfig') {
        console.log('飞书配置已更新')
      } else if (key === 'tableDataConfig') {
        console.log('表格数据配置已更新')
      }
    })
  }
})

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason)
})
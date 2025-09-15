// 飞书API集成的background script
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 当用户点击插件图标时，向当前激活的标签页的 content script 发送消息
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: "TOGGLE_SIDE_PANEL"
      });
    }
  } catch (error) {
    console.error('发送侧边栏切换消息失败:', error);
  }
});

// 飞书API客户端类（内联版本以避免模块导入问题）
class FeishuAPIClient {
  private config: any;
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(config: any) {
    this.config = {
      baseUrl: 'https://open.feishu.cn',
      ...config
    };
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        }),
      });

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`获取访问令牌失败: ${data.msg}`);
      }

      this.accessToken = data.data.tenant_access_token;
      this.tokenExpireTime = Date.now() + (data.data.expire - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('获取访问令牌失败:', error);
      throw error;
    }
  }

  async uploadFile(file: File | Blob, filename: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const prepareResponse = await fetch(`${this.config.baseUrl}/open-apis/drive/v1/medias/upload_all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          file_name: filename,
          parent_type: 'bitable_image',
          parent_node: '',
        }),
      });

      const prepareData = await prepareResponse.json();
      
      if (prepareData.code !== 0) {
        throw new Error(`准备上传失败: ${prepareData.msg}`);
      }

      const uploadData = prepareData.data;
      
      const uploadResponse = await fetch(uploadData.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Cos-ACL': 'public-read',
          'X-Cos-Meta-File-Name': encodeURIComponent(filename),
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`文件上传失败: ${uploadResponse.statusText}`);
      }

      return {
        fileToken: uploadData.file_token,
        url: uploadData.url,
        name: filename,
        size: file.size,
        type: file instanceof File ? file.type : 'application/octet-stream',
      };
    } catch (error) {
      console.error('文件上传失败:', error);
      throw error;
    }
  }

  async writeTableRecords(appToken: string, tableId: string, records: any[]): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const batchSize = 500;
      const results = [];

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        const response = await fetch(`${this.config.baseUrl}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            fields: batch.map(record => record.fields),
          }),
        });

        const data = await response.json();
        
        if (data.code !== 0) {
          throw new Error(`写入表格失败: ${data.msg}`);
        }

        results.push({
          batch: Math.floor(i / batchSize) + 1,
          records: batch.length,
          recordIds: data.data.records?.map((r: any) => r.record_id) || [],
        });

        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      return results;
    } catch (error) {
      console.error('写入表格失败:', error);
      throw error;
    }
  }

  static parseTableUrl(url: string): { appToken: string; tableId: string } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      const appToken = pathParts[pathParts.length - 1];
      const tableId = urlObj.searchParams.get('table');
      
      if (!appToken || !tableId) {
        throw new Error('无效的多维表格URL格式');
      }

      return { appToken, tableId };
    } catch (error) {
      throw new Error(`解析表格URL失败: ${error.message}`);
    }
  }

  async getTableFields(appToken: string, tableId: string): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.config.baseUrl}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      });

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`获取表格字段失败: ${data.msg}`);
      }

      return data.data.items || [];
    } catch (error) {
      console.error('获取表格字段失败:', error);
      throw error;
    }
  }
}

// 全局变量存储飞书客户端
let feishuClient: FeishuAPIClient | null = null;

// 初始化飞书客户端
async function initFeishuClient(): Promise<FeishuAPIClient | null> {
  try {
    // 从存储获取配置 - 兼容多种键名
    const result = await chrome.storage.sync.get(['feishuAppId', 'feishuAppSecret']);
    
    console.log('飞书配置检查:', { 
      hasAppId: !!result.feishuAppId, 
      hasAppSecret: !!result.feishuAppSecret 
    });
    
    if (!result.feishuAppId || !result.feishuAppSecret) {
      console.error('飞书配置不完整 - 缺少AppId或AppSecret');
      return null;
    }

    feishuClient = new FeishuAPIClient({
      appId: result.feishuAppId,
      appSecret: result.feishuAppSecret
    });

    return feishuClient;
  } catch (error) {
    console.error('初始化飞书客户端失败:', error);
    return null;
  }
}

// 将URL转换为File对象
async function urlToFile(url: string, filename: string): Promise<File> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  } catch (error) {
    console.error('URL转File失败:', error);
    throw error;
  }
}

// 主要的消息处理
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    switch (message.type) {
      case 'PROCESS_NOTE_DATA':
        console.log('开始处理笔记数据:', message.data);
        processNoteData(message.data, sendResponse);
        return true; // 保持消息通道开放用于异步响应
        break;
        
      case 'TEST_CONFIG':
        console.log('测试配置:', message.config);
        testConfig(message.config, sendResponse);
        return true; // 保持消息通道开放用于异步响应
        break;
        
      case 'PING':
        sendResponse({ pong: true });
        break;
        
      default:
        console.log('未处理的消息类型:', message.type);
        sendResponse({ success: false, error: '未知的消息类型' });
    }
  } catch (error) {
    console.error('处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // 保持消息通道开放
});

// 处理笔记数据的核心函数
async function processNoteData(data: any, sendResponse: (response: any) => void) {
  try {
    const { noteData, files } = data;
    
    // 获取飞书配置 - 兼容多种键名
    const configResult = await chrome.storage.sync.get(['feishuSpreadsheetUrl', 'feishuTableUrl', 'feishuAppToken', 'feishuTableId']);
    const tableUrl = configResult.feishuSpreadsheetUrl || configResult.feishuTableUrl;
    const appToken = configResult.feishuAppToken;
    const tableId = configResult.feishuTableId;
    
    if (!tableUrl) {
      throw new Error('未配置飞书表格URL');
    }

    // 如果有appToken和tableId直接使用，否则解析URL
    let finalAppToken = appToken;
    let finalTableId = tableId;
    
    if (!finalAppToken || !finalTableId) {
      const parsed = FeishuAPIClient.parseTableUrl(tableUrl);
      finalAppToken = parsed.appToken;
      finalTableId = parsed.tableId;
    }

    // 初始化飞书客户端 - 这会验证AppId和AppSecret是否配置
    const client = await initFeishuClient();
    if (!client) {
      throw new Error('飞书客户端初始化失败 - 请检查AppId和AppSecret配置');
    }

    console.log('配置验证成功:', { 
      hasAppToken: !!finalAppToken, 
      hasTableId: !!finalTableId, 
      tableUrl: tableUrl?.substring(0, 50) + '...' 
    });

    // 处理文件上传
    const uploadedFiles = await processFileUploads(client, files);
    console.log('文件上传完成:', uploadedFiles);

    // 构建表格记录
    const record = buildTableRecord(noteData, uploadedFiles);
    console.log('构建表格记录:', record);

    // 写入表格
    const result = await client.writeTableRecords(finalAppToken, finalTableId, [record]);
    console.log('表格写入结果:', result);

    sendResponse({ 
      success: true, 
      message: '数据已成功写入飞书表格',
      data: { result, uploadedFiles }
    });

  } catch (error) {
    console.error('处理笔记数据失败:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// 处理文件上传
async function processFileUploads(client: FeishuAPIClient, files: any[]): Promise<any[]> {
  const uploadedFiles = [];
  
  for (const file of files) {
    if (!file.url) continue;

    try {
      // 生成文件名
      const fileExtension = file.type === 'video' ? '.mp4' : '.jpg';
      const timestamp = Date.now();
      const filename = `${file.type}_${timestamp}${fileExtension}`;

      // 转换并上传文件
      const fileObj = await urlToFile(file.url, filename);
      const uploadResult = await client.uploadFile(fileObj, filename);

      uploadedFiles.push({
        type: file.type,
        fileToken: uploadResult.fileToken,
        url: uploadResult.url,
        name: uploadResult.name
      });

      console.log(`${file.type}上传成功:`, uploadResult.name);

      // 避免API频率限制
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`${file.type}上传失败:`, error);
      // 继续处理其他文件，不要因为单个文件失败而终止整个流程
    }
  }

  return uploadedFiles;
}

// 构建表格记录
function buildTableRecord(noteData: any, uploadedFiles: any[]) {
  const fields: Record<string, any> = {
    // 基础信息
    '标题': noteData.title || '',
    '作者': noteData.author || '',
    '内容': noteData.content || '',
    '标签': noteData.tags?.join(', ') || '',
    
    // 统计数据
    '点赞数': noteData.likes || 0,
    '收藏数': noteData.collects || 0,
    '评论数': noteData.comments || 0,
    
    // 时间戳
    '采集时间': new Date().toISOString(),
  };

  // 添加文件信息
  const images = uploadedFiles.filter(f => f.type === 'image');
  const videos = uploadedFiles.filter(f => f.type === 'video');

  if (images.length > 0) {
    fields['图片'] = images.map(img => img.fileToken).join(',');
    fields['图片链接'] = images.map(img => img.url).join('\n');
  }

  if (videos.length > 0) {
    fields['视频'] = videos.map(video => video.fileToken).join(',');
    fields['视频链接'] = videos.map(video => video.url).join('\n');
  }

  // 添加源URL
  fields['源链接'] = noteData.sourceUrl || '';

  return { fields };
}

// 测试配置函数
async function testConfig(config: any, sendResponse: (response: any) => void) {
  try {
    // 验证配置完整性
    if (!config.feishuTableUrl || !config.feishuAppId || !config.feishuAppSecret) {
      throw new Error('配置不完整');
    }

    // 初始化飞书客户端
    const client = new FeishuAPIClient({
      appId: config.feishuAppId,
      appSecret: config.feishuAppSecret
    });

    // 测试获取访问令牌
    const accessToken = await client.getAccessToken();
    
    // 解析表格URL
    const { appToken, tableId } = FeishuAPIClient.parseTableUrl(config.feishuTableUrl);
    
    // 测试获取表格信息
    const fields = await client.getTableFields(appToken, tableId);

    sendResponse({
      success: true,
      message: '配置测试成功',
      data: {
        hasAccessToken: !!accessToken,
        tableFields: fields.length,
        appToken,
        tableId
      }
    });

  } catch (error) {
    console.error('配置测试失败:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// 安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('小红书笔记采集器已安装（简化版）');
});

// 启动事件
console.log('小红书笔记采集器已启动（简化版）');
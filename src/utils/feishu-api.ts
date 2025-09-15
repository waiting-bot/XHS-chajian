// 飞书API客户端
export interface FeishuConfig {
  appId: string;
  appSecret: string;
  baseUrl?: string;
}

export interface FeishuTableRecord {
  fields: Record<string, any>;
}

export interface FeishuUploadResult {
  fileToken: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

export class FeishuAPIClient {
  private config: FeishuConfig;
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(config: FeishuConfig) {
    this.config = {
      baseUrl: 'https://open.feishu.cn',
      ...config
    };
  }

  // 获取访问令牌
  async getAccessToken(): Promise<string> {
    // 如果令牌未过期，直接返回
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
      // 令牌有效期2小时，提前5分钟过期
      this.tokenExpireTime = Date.now() + (data.data.expire - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('获取访问令牌失败:', error);
      throw error;
    }
  }

  // 上传文件
  async uploadFile(file: File | Blob, filename: string): Promise<FeishuUploadResult> {
    try {
      const accessToken = await this.getAccessToken();
      
      // 第一步：获取上传地址
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
      
      // 第二步：上传文件
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

  // 批量写入多维表格数据
  async writeTableRecords(appToken: string, tableId: string, records: FeishuTableRecord[]): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      // 飞书API限制每次最多写入500条记录
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

        // 避免API频率限制
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

  // 解析多维表格URL
  static parseTableUrl(url: string): { appToken: string; tableId: string } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      // URL格式: /base/{appToken}?table={tableId}
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

  // 获取表格字段信息
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
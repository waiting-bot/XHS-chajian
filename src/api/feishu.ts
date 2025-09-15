export interface FeishuConfig {
  appId: string
  appSecret: string
  accessToken: string
  tableId: string
  baseUrl: string
}

export interface FeishuField {
  field_name: string
  type: 'text' | 'number' | 'attachment' | 'datetime' | 'user' | 'select'
  [key: string]: any
}

export interface FeishuRecord {
  fields: Record<string, any>
  record_id?: string
}

export interface FeishuUploadResult {
  fileToken: string
  name: string
  size: number
  type: string
  url?: string
}

export class FeishuClient {
  private config: FeishuConfig
  private tokenExpiry: number = 0

  constructor(config: Partial<FeishuConfig>) {
    this.config = {
      appId: config.appId || '',
      appSecret: config.appSecret || '',
      accessToken: config.accessToken || '',
      tableId: config.tableId || '',
      baseUrl: config.baseUrl || 'https://open.feishu.cn',
    }
  }

  public async updateConfig(config: Partial<FeishuConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    // 不再直接保存配置，由配置管理器统一管理
  }

  public async saveConfig(): Promise<void> {
    // 不再直接保存配置，由配置管理器统一管理
    console.warn('FeishuClient.saveConfig() 已弃用，请使用 ConfigManager')
  }

  public async loadConfig(): Promise<void> {
    // 不再直接加载配置，由配置管理器统一管理
    console.warn('FeishuClient.loadConfig() 已弃用，请使用 ConfigManager')
  }

  public async getAccessToken(): Promise<string> {
    // 如果有access token且未过期，直接使用
    if (this.config.accessToken && Date.now() < this.tokenExpiry) {
      return this.config.accessToken
    }

    // 如果没有appId和appSecret，使用用户提供的access token
    if (!this.config.appId || !this.config.appSecret) {
      if (!this.config.accessToken) {
        throw new Error('请提供飞书Access Token')
      }
      return this.config.accessToken
    }

    // 使用app credentials获取access token
    return await this.refreshAccessToken()
  }

  private async refreshAccessToken(): Promise<string> {
    const url = `${this.config.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `获取Access Token失败: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`飞书API错误: ${data.msg}`)
    }

    this.config.accessToken = data.tenant_access_token
    this.tokenExpiry = Date.now() + (data.expire - 300) * 1000 // 提前5分钟过期

    // 不再直接保存配置，由配置管理器统一管理

    return this.config.accessToken
  }

  public async testConnection(): Promise<boolean> {
    try {
      const token = await this.getAccessToken()
      const url = `${this.config.baseUrl}/open-apis/bitable/v1/apps/${this.config.tableId}/tables`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      return response.ok
    } catch (error) {
      console.error('测试连接失败:', error)
      return false
    }
  }

  public async getTableFields(tableId?: string): Promise<FeishuField[]> {
    const token = await this.getAccessToken()
    const table = tableId || this.config.tableId

    if (!table) {
      throw new Error('请提供表格ID')
    }

    const url = `${this.config.baseUrl}/open-apis/bitable/v1/apps/${this.config.tableId}/tables/${table}/fields`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(
        `获取表格字段失败: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`飞书API错误: ${data.msg}`)
    }

    return data.data.items || []
  }

  public async uploadFile(
    file: Blob,
    filename: string,
    onProgress?: (progress: number) => void
  ): Promise<FeishuUploadResult> {
    const token = await this.getAccessToken()

    // 首先获取上传地址
    const prepareUrl = `${this.config.baseUrl}/open-apis/drive/v1/medias/upload_all`

    const prepareResponse = await fetch(prepareUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: filename,
        file_type: file.type,
        file_size: file.size,
        parent_type: 'bitable_image',
        parent_node: this.config.tableId,
      }),
    })

    if (!prepareResponse.ok) {
      throw new Error(
        `准备上传失败: ${prepareResponse.status} ${prepareResponse.statusText}`
      )
    }

    const prepareData = await prepareResponse.json()

    if (prepareData.code !== 0) {
      throw new Error(`飞书API错误: ${prepareData.msg}`)
    }

    const { upload_url, file_token } = prepareData.data

    // 上传文件
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Content-Length': file.size.toString(),
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error(
        `上传文件失败: ${uploadResponse.status} ${uploadResponse.statusText}`
      )
    }

    return {
      fileToken: file_token,
      name: filename,
      size: file.size,
      type: file.type,
    }
  }

  public async createRecord(
    record: FeishuRecord,
    tableId?: string
  ): Promise<{ record_id: string }> {
    const token = await this.getAccessToken()
    const table = tableId || this.config.tableId

    if (!table) {
      throw new Error('请提供表格ID')
    }

    // 验证配置有效性
    if (!this.isValidConfig()) {
      throw new Error('无效的飞书配置')
    }
    
    // 构建请求数据
    const payload = {
      fields: record.fields
    }
    
    // 添加调试日志
    console.debug('飞书写入请求:', payload)
    
    const url = `${this.config.baseUrl}/open-apis/bitable/v1/apps/${this.config.tableId}/tables/${table}/records`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    
    // 添加响应日志
    console.log('飞书API响应:', {
      status: response.status,
      data: result
    })
    
    // 验证响应
    if (!response.ok || result.code !== 0) {
      throw new Error(`飞书API错误: ${result.msg || '未知错误'}`)
    }

    return {
      record_id: result.data.record.record_id,
    }
  }

  public async batchCreateRecords(
    records: FeishuRecord[],
    tableId?: string
  ): Promise<{ record_id: string }[]> {
    const token = await this.getAccessToken()
    const table = tableId || this.config.tableId

    if (!table) {
      throw new Error('请提供表格ID')
    }

    const url = `${this.config.baseUrl}/open-apis/bitable/v1/apps/${this.config.tableId}/tables/${table}/records/batch_create`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: records.map(record => ({
          fields: record.fields,
        })),
      }),
    })

    if (!response.ok) {
      throw new Error(
        `批量创建记录失败: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`飞书API错误: ${data.msg}`)
    }

    return data.data.records.map((record: any) => ({
      record_id: record.record_id,
    }))
  }

  public async updateRecord(
    recordId: string,
    record: FeishuRecord,
    tableId?: string
  ): Promise<void> {
    const token = await this.getAccessToken()
    const table = tableId || this.config.tableId

    if (!table) {
      throw new Error('请提供表格ID')
    }

    const url = `${this.config.baseUrl}/open-apis/bitable/v1/apps/${this.config.tableId}/tables/${table}/records/${recordId}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: record.fields,
      }),
    })

    if (!response.ok) {
      throw new Error(`更新记录失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`飞书API错误: ${data.msg}`)
    }
  }

  public async searchRecords(
    filter: Record<string, any>,
    tableId?: string
  ): Promise<FeishuRecord[]> {
    const token = await this.getAccessToken()
    const table = tableId || this.config.tableId

    if (!table) {
      throw new Error('请提供表格ID')
    }

    const url = `${this.config.baseUrl}/open-apis/bitable/v1/apps/${this.config.tableId}/tables/${table}/records/search`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: filter,
      }),
    })

    if (!response.ok) {
      throw new Error(`搜索记录失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`飞书API错误: ${data.msg}`)
    }

    return data.data.items || []
  }

  public getConfig(): FeishuConfig {
    return { ...this.config }
  }

  public isConfigured(): boolean {
    return !!(
      this.config.accessToken ||
      (this.config.appId && this.config.appSecret)
    )
  }

  // 验证配置有效性
  private isValidConfig(): boolean {
    return !!(
      this.config.tableId &&
      (this.config.accessToken || (this.config.appId && this.config.appSecret))
    )
  }
}

export const feishuClient = new FeishuClient({})

export default FeishuClient

import { NotePageData } from '../content/content'
import { FileInfo } from './fileProcessor'
import { FeishuClient, FeishuRecord } from '../api/feishu'

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

export interface ProcessingResult {
  success: boolean
  recordId?: string
  error?: string
  data?: NotePageData
  files?: FileInfo[]
}

export interface TableDataConfig {
  fieldMapping: FieldMapping
  tableId: string
  autoUploadFiles: boolean
  maxFileSize: number
  allowedTypes: string[]
}

export class DataProcessor {
  private config: TableDataConfig = {
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
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
  }

  constructor(private feishuClient: FeishuClient) {
    this.loadConfig()
  }

  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['tableDataConfig'])
      if (result.tableDataConfig) {
        this.config = { ...this.config, ...result.tableDataConfig }
      }
    } catch (error) {
      console.warn('加载表格数据配置失败:', error)
    }
  }

  public async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({ tableDataConfig: this.config })
    } catch (error) {
      console.error('保存表格数据配置失败:', error)
      throw error
    }
  }

  public async updateConfig(config: Partial<TableDataConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    await this.saveConfig()
  }

  public async processData(
    noteData: NotePageData,
    files?: FileInfo[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<ProcessingResult> {
    try {
      if (!this.feishuClient.isConfigured()) {
        throw new Error('飞书配置未完成')
      }

      onProgress?.(0, '开始处理数据...')

      // 上传文件
      let uploadedFiles: FileInfo[] = []
      if (files && files.length > 0 && this.config.autoUploadFiles) {
        onProgress?.(20, '上传文件中...')
        uploadedFiles = await this.uploadFiles(files, (fileProgress) => {
          onProgress?.(20 + fileProgress * 30, `上传文件 ${fileProgress * 100}%`)
        })
      }

      // 构建表格数据
      onProgress?.(50, '构建表格数据...')
      const tableData = this.buildTableData(noteData, uploadedFiles)

      // 写入表格
      onProgress?.(70, '写入表格中...')
      const result = await this.feishuClient.createRecord({
        fields: tableData
      })

      onProgress?.(100, '处理完成')

      return {
        success: true,
        recordId: result.record_id,
        data: noteData,
        files: uploadedFiles
      }
    } catch (error) {
      console.error('处理数据失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理数据失败',
        data: noteData,
        files: files
      }
    }
  }

  public async batchProcessData(
    dataList: Array<{ noteData: NotePageData; files?: FileInfo[] }>,
    onProgress?: (progress: number, message: string) => void
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = []
    const total = dataList.length

    for (let i = 0; i < dataList.length; i++) {
      const { noteData, files } = dataList[i]
      const progress = (i / total) * 100
      
      onProgress?.(progress, `处理第 ${i + 1}/${total} 条数据...`)
      
      const result = await this.processData(noteData, files, (fileProgress, message) => {
        onProgress?.(progress + (fileProgress / total), message)
      })
      
      results.push(result)
    }

    return results
  }

  private async uploadFiles(
    files: FileInfo[],
    onProgress?: (progress: number) => void
  ): Promise<FileInfo[]> {
    const uploadedFiles: FileInfo[] = []
    const total = files.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const progress = (i / total) * 100
      onProgress?.(progress)

      try {
        if (file.blob && !file.uploaded) {
          const uploadResult = await this.feishuClient.uploadFile(
            file.blob,
            file.filename
          )

          uploadedFiles.push({
            ...file,
            uploaded: true,
            fileId: uploadResult.fileToken,
            error: null
          })
        } else if (file.uploaded) {
          uploadedFiles.push(file)
        }
      } catch (error) {
        uploadedFiles.push({
          ...file,
          uploaded: false,
          fileId: null,
          error: error instanceof Error ? error.message : '上传失败'
        })
      }
    }

    return uploadedFiles
  }

  private buildTableData(noteData: NotePageData, files: FileInfo[]): Record<string, any> {
    const { fieldMapping } = this.config
    const tableData: Record<string, any> = {}

    // 基础字段映射
    tableData[fieldMapping.title] = noteData.title
    tableData[fieldMapping.author] = noteData.author
    tableData[fieldMapping.content] = noteData.content
    tableData[fieldMapping.tags] = noteData.tags.join(', ')
    tableData[fieldMapping.likes] = noteData.likes
    tableData[fieldMapping.collects] = noteData.collects
    tableData[fieldMapping.comments] = noteData.comments
    tableData[fieldMapping.url] = window.location.href
    tableData[fieldMapping.createTime] = new Date().toISOString()

    // 文件字段映射
    const imageFiles = files.filter(f => f.type === 'image' && f.uploaded)
    const videoFiles = files.filter(f => f.type === 'video' && f.uploaded)

    if (imageFiles.length > 0) {
      tableData[fieldMapping.images] = imageFiles.map(f => ({
        file_token: f.fileId,
        file_name: f.filename
      }))
    }

    if (videoFiles.length > 0) {
      tableData[fieldMapping.video] = videoFiles.map(f => ({
        file_token: f.fileId,
        file_name: f.filename
      }))[0] || null
    }

    return tableData
  }

  public async validateData(noteData: NotePageData): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!noteData.title || noteData.title.trim().length === 0) {
      errors.push('标题不能为空')
    }

    if (!noteData.author || noteData.author.trim().length === 0) {
      errors.push('作者不能为空')
    }

    if (!noteData.content || noteData.content.trim().length === 0) {
      errors.push('正文不能为空')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  public async testFieldMapping(): Promise<{ success: boolean; errors: string[] }> {
    try {
      const fields = await this.feishuClient.getTableFields()
      const { fieldMapping } = this.config
      const errors: string[] = []

      const fieldNames = fields.map(f => f.field_name)

      Object.values(fieldMapping).forEach(fieldName => {
        if (!fieldNames.includes(fieldName)) {
          errors.push(`字段 "${fieldName}" 不存在于表格中`)
        }
      })

      return {
        success: errors.length === 0,
        errors
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : '验证字段映射失败']
      }
    }
  }

  public getFieldMapping(): FieldMapping {
    return { ...this.config.fieldMapping }
  }

  public async updateFieldMapping(mapping: Partial<FieldMapping>): Promise<void> {
    this.config.fieldMapping = { ...this.config.fieldMapping, ...mapping }
    await this.saveConfig()
  }

  public getConfig(): TableDataConfig {
    return { ...this.config }
  }

  public async exportConfig(): Promise<string> {
    return JSON.stringify(this.config, null, 2)
  }

  public async importConfig(configJson: string): Promise<boolean> {
    try {
      const importedConfig = JSON.parse(configJson)
      await this.updateConfig(importedConfig)
      return true
    } catch (error) {
      console.error('导入配置失败:', error)
      return false
    }
  }

  public async getProcessingStatistics(): Promise<{
    total: number
    success: number
    failed: number
    lastProcessed?: Date
  }> {
    try {
      const result = await chrome.storage.local.get(['processingStats'])
      return result.processingStats || {
        total: 0,
        success: 0,
        failed: 0
      }
    } catch {
      return {
        total: 0,
        success: 0,
        failed: 0
      }
    }
  }

  public async updateProcessingStats(result: ProcessingResult): Promise<void> {
    try {
      const stats = await this.getProcessingStatistics()
      stats.total++
      
      if (result.success) {
        stats.success++
        stats.lastProcessed = new Date()
      } else {
        stats.failed++
      }

      await chrome.storage.local.set({ processingStats: stats })
    } catch (error) {
      console.error('更新处理统计失败:', error)
    }
  }
}

export class BatchProcessor {
  private queue: Array<{ noteData: NotePageData; files?: FileInfo[] }> = []
  private isProcessing = false
  private maxConcurrent = 3

  constructor(private dataProcessor: DataProcessor) {}

  public addToQueue(data: { noteData: NotePageData; files?: FileInfo[] }): void {
    this.queue.push(data)
  }

  public async processQueue(
    onProgress?: (progress: number, message: string) => void
  ): Promise<ProcessingResult[]> {
    if (this.isProcessing) {
      throw new Error('正在处理其他任务')
    }

    this.isProcessing = true
    const results: ProcessingResult[] = []

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.maxConcurrent)
        const batchResults = await Promise.all(
          batch.map((item, index) => 
            this.dataProcessor.processData(item.noteData, item.files, (progress, message) => {
              const totalProgress = ((this.queue.length + index) / (this.queue.length + batch.length)) * 100
              onProgress?.(totalProgress, message)
            })
          )
        )
        
        results.push(...batchResults)
      }

      return results
    } finally {
      this.isProcessing = false
    }
  }

  public getQueueLength(): number {
    return this.queue.length
  }

  public clearQueue(): void {
    this.queue = []
  }

  public setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, Math.min(max, 10))
  }
}

export { DataProcessor as default }
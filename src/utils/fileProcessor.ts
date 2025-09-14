export interface FileInfo {
  id: string
  url: string
  type: 'image' | 'video'
  filename: string
  size: number
  mimeType: string
  blob: Blob | null
  uploaded: boolean
  fileId: string | null
  error: string | null
}

export interface FileProcessingOptions {
  maxFileSize: number
  allowedTypes: string[]
  quality?: number
  format?: 'blob' | 'base64'
}

export class FileProcessor {
  private options: FileProcessingOptions = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
    quality: 0.8,
    format: 'blob'
  };

  constructor(options?: Partial<FileProcessingOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  public async processFiles(urls: string[]): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    for (const url of urls) {
      try {
        const fileInfo = await this.processSingleFile(url);
        results.push(fileInfo);
      } catch (error) {
        const errorFileInfo: FileInfo = {
          id: this.generateId(),
          url,
          type: this.getFileType(url),
          filename: this.getFilename(url),
          size: 0,
          mimeType: '',
          blob: null,
          uploaded: false,
          fileId: null,
          error: error instanceof Error ? error.message : '处理文件失败'
        };
        results.push(errorFileInfo);
      }
    }

    return results;
  }

  private async processSingleFile(url: string): Promise<FileInfo> {
    const id = this.generateId();
    const type = this.getFileType(url);
    const filename = this.getFilename(url);

    // 下载文件
    const response = await this.downloadFile(url);
    
    // 验证文件类型和大小
    this.validateFile(response, type);

    // 转换为Blob
    const blob = await this.convertToBlob(response);
    
    // 如果是图片，可以进行优化
    let processedBlob = blob;
    if (type === 'image') {
      processedBlob = await this.optimizeImage(blob, this.options.quality);
    }

    return {
      id,
      url,
      type,
      filename,
      size: processedBlob.size,
      mimeType: processedBlob.type,
      blob: processedBlob,
      uploaded: false,
      fileId: null,
      error: null
    };
  }

  private async downloadFile(url: string): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`下载文件失败: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      throw new Error(`网络请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private validateFile(response: Response, type: 'image' | 'video'): void {
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    if (!contentType) {
      throw new Error('无法确定文件类型');
    }

    if (!this.options.allowedTypes.includes(contentType)) {
      throw new Error(`不支持的文件类型: ${contentType}`);
    }

    if (contentLength) {
      const size = parseInt(contentLength);
      if (size > this.options.maxFileSize) {
        throw new Error(`文件大小超过限制: ${size} > ${this.options.maxFileSize}`);
      }
    }

    const expectedType = type === 'image' ? 'image/' : 'video/';
    if (!contentType.startsWith(expectedType)) {
      throw new Error(`文件类型不匹配: 期望 ${expectedType}, 实际 ${contentType}`);
    }
  }

  private async convertToBlob(response: Response): Promise<Blob> {
    try {
      return await response.blob();
    } catch (error) {
      throw new Error(`转换文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async optimizeImage(blob: Blob, quality: number = 0.8): Promise<Blob> {
    if (!blob.type.startsWith('image/')) {
      return blob;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);

        // 创建canvas进行压缩
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(blob);
          return;
        }

        // 保持原始尺寸
        canvas.width = img.width;
        canvas.height = img.height;

        // 绘制图片
        ctx.drawImage(img, 0, 0);

        // 转换为新的blob
        canvas.toBlob(
          (optimizedBlob) => {
            if (optimizedBlob) {
              resolve(optimizedBlob);
            } else {
              resolve(blob);
            }
          },
          blob.type,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };

      img.src = url;
    });
  }

  private getFileType(url: string): 'image' | 'video' {
    const extension = this.getFileExtension(url);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const videoExtensions = ['mp4', 'webm', 'ogg'];

    if (imageExtensions.includes(extension)) {
      return 'image';
    }

    if (videoExtensions.includes(extension)) {
      return 'video';
    }

    // 根据URL中的关键词判断
    if (url.includes('image') || url.includes('photo')) {
      return 'image';
    }

    if (url.includes('video')) {
      return 'video';
    }

    return 'image'; // 默认为图片
  }

  private getFileExtension(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
      return match ? match[1].toLowerCase() : '';
    } catch {
      return '';
    }
  }

  private getFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'unknown';
      
      // 清理文件名
      return filename.replace(/[^\w\-.]/g, '_');
    } catch {
      return `file_${this.generateId()}`;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  public async convertToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public async getFileMetadata(url: string): Promise<Partial<FileInfo>> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      
      return {
        type: this.getFileType(url),
        filename: this.getFilename(url),
        size: parseInt(response.headers.get('content-length') || '0'),
        mimeType: response.headers.get('content-type') || ''
      };
    } catch {
      return {
        type: this.getFileType(url),
        filename: this.getFilename(url),
        size: 0,
        mimeType: ''
      };
    }
  }

  public updateOptions(options: Partial<FileProcessingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public getOptions(): FileProcessingOptions {
    return { ...this.options };
  }
}

export class FileDownloader {
  private downloadQueue: { url: string; priority: number }[] = [];
  private isProcessing = false;

  constructor(private processor: FileProcessor) {}

  public async downloadFiles(urls: string[], maxConcurrent: number = 3): Promise<FileInfo[]> {
    const chunks = this.chunkArray(urls, maxConcurrent);
    const results: FileInfo[] = [];

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(url => this.processor.processSingleFile(url))
      );
      
      chunkResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('下载文件失败:', result.reason);
        }
      });
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const fileProcessor = new FileProcessor();
export const fileDownloader = new FileDownloader(fileProcessor);

export default FileProcessor;
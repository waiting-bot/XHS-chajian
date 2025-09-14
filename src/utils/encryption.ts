import type { EncryptionKey } from '../types/config';

export class EncryptionManager {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  private encryptionKey: CryptoKey | null = null;
  private keyVersion: number = 1;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.generateOrLoadKey();
    } catch (error) {
      console.error('加密管理器初始化失败:', error);
    }
  }

  private async generateOrLoadKey(): Promise<void> {
    try {
      // 尝试从Chrome存储加载现有密钥
      const result = await chrome.storage.local.get(['encryptionKey']);
      
      if (result.encryptionKey) {
        const keyData = await this.importKey(result.encryptionKey.keyData);
        this.encryptionKey = keyData;
        this.keyVersion = result.encryptionKey.version || 1;
      } else {
        // 生成新密钥
        await this.generateNewKey();
      }
    } catch (error) {
      console.error('加载或生成加密密钥失败:', error);
      await this.generateNewKey();
    }
  }

  private async generateNewKey(): Promise<void> {
    try {
      // 使用扩展ID作为密钥派生的一部分
      const extensionId = chrome.runtime.id;
      const salt = new TextEncoder().encode(extensionId + '_xiaohongshu_collector_salt');
      
      // 生成主密钥
      const masterKey = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: this.KEY_LENGTH,
        },
        true,
        ['encrypt', 'decrypt']
      );

      this.encryptionKey = masterKey;
      this.keyVersion = 1;

      // 导出并保存密钥
      const exportedKey = await crypto.subtle.exportKey('raw', masterKey);
      const keyData = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
      
      const encryptionKey: EncryptionKey = {
        algorithm: this.ALGORITHM,
        keyData,
        iv: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(this.IV_LENGTH)))),
        version: this.keyVersion
      };

      await chrome.storage.local.set({ encryptionKey });
    } catch (error) {
      console.error('生成新密钥失败:', error);
      throw error;
    }
  }

  private async importKey(keyData: string): Promise<CryptoKey> {
    try {
      const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
      return await crypto.subtle.importKey(
        'raw',
        binaryKey,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('导入密钥失败:', error);
      throw error;
    }
  }

  async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey) {
      console.warn('加密密钥未初始化，返回原始数据');
      return data;
    }

    try {
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data);
      
      // 生成随机IV
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      // 加密数据
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        this.encryptionKey,
        dataBytes
      );

      // 组合IV + 加密数据 + 版本信息
      const result = new Uint8Array(iv.length + encryptedData.byteLength + 1);
      result.set(iv, 0);
      result.set(new Uint8Array(encryptedData), iv.length);
      result[iv.length + encryptedData.byteLength] = this.keyVersion;

      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.error('加密失败:', error);
      throw new Error('数据加密失败');
    }
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      console.warn('加密密钥未初始化，返回原始数据');
      return encryptedData;
    }

    try {
      const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      // 提取版本信息
      const version = data[data.length - 1];
      
      // 提取IV和加密数据
      const iv = data.slice(0, this.IV_LENGTH);
      const encrypted = data.slice(this.IV_LENGTH, data.length - 1);
      
      // 解密数据
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        this.encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('解密失败:', error);
      throw new Error('数据解密失败');
    }
  }

  async encryptSensitiveFields<T extends Record<string, any>>(
    data: T,
    sensitiveFields: string[] = ['accessToken', 'appSecret']
  ): Promise<T> {
    const encryptedData = { ...data };
    
    for (const field of sensitiveFields) {
      if (encryptedData[field] && typeof encryptedData[field] === 'string') {
        try {
          encryptedData[field] = await this.encrypt(encryptedData[field]);
        } catch (error) {
          console.error(`加密字段 ${field} 失败:`, error);
        }
      }
    }
    
    return encryptedData;
  }

  async decryptSensitiveFields<T extends Record<string, any>>(
    data: T,
    sensitiveFields: string[] = ['accessToken', 'appSecret']
  ): Promise<T> {
    const decryptedData = { ...data };
    
    for (const field of sensitiveFields) {
      if (decryptedData[field] && typeof decryptedData[field] === 'string') {
        try {
          decryptedData[field] = await this.decrypt(decryptedData[field]);
        } catch (error) {
          console.error(`解密字段 ${field} 失败:`, error);
        }
      }
    }
    
    return decryptedData;
  }

  async rotateKey(): Promise<void> {
    try {
      // 生成新密钥
      await this.generateNewKey();
      console.log('加密密钥已更新');
    } catch (error) {
      console.error('轮换加密密钥失败:', error);
      throw error;
    }
  }

  isEncryptionEnabled(): boolean {
    return this.encryptionKey !== null;
  }

  getKeyVersion(): number {
    return this.keyVersion;
  }

  async clearKey(): Promise<void> {
    try {
      await chrome.storage.local.remove(['encryptionKey']);
      this.encryptionKey = null;
      this.keyVersion = 1;
      console.log('加密密钥已清除');
    } catch (error) {
      console.error('清除加密密钥失败:', error);
    }
  }
}

// 导出单例实例
export const encryptionManager = new EncryptionManager();
export default EncryptionManager;
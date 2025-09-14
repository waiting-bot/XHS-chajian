import type { EncryptionKey } from '../types/config';
import { storageManager } from './storageManager';
import { SafeStorage } from './safeStorage';

export class EncryptionManager {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  private encryptionKey: CryptoKey | null = null;
  private keyVersion: number = 1;
  private isInitialized: boolean = false;

  constructor() {
    // 不在构造函数中自动初始化，改为懒加载
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.generateOrLoadKey();
      this.isInitialized = true;
      console.log('加密管理器初始化成功');
    } catch (error) {
      console.error('加密管理器初始化失败:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async generateOrLoadKey(): Promise<void> {
    try {
      // 等待存储管理器就绪
      await storageManager.ready;
      
      // 尝试从Chrome存储加载现有密钥
      const result = await SafeStorage.get(['encryptionKey']);
      
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
      // 检查 Chrome API 是否可用
      if (!chrome || !chrome.runtime) {
        throw new Error('Chrome runtime API 不可用');
      }
      
      // 使用扩展ID作为密钥派生的一部分
      const extensionId = chrome.runtime.id || 'unknown';
      const salt = new TextEncoder().encode(extensionId + '_xiaohongshu_collector_salt');
      
      // 生成主密钥 - 使用 literal 值避免静态属性访问问题
      const masterKey = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256, // 直接使用 literal 值而不是静态属性
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
        algorithm: 'AES-GCM', // 使用 literal 值
        keyData,
        iv: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))), // 直接使用 literal 值
        version: this.keyVersion
      };

      await SafeStorage.set({ encryptionKey });
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
    await this.ensureInitialized();
    
    if (!this.encryptionKey) {
      console.warn('加密密钥未初始化，返回原始数据');
      return data;
    }

    try {
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data);
      
      // 生成随机IV
      const iv = crypto.getRandomValues(new Uint8Array(EncryptionManager.IV_LENGTH));
      
      // 加密数据
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: EncryptionManager.ALGORITHM,
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
    await this.ensureInitialized();
    
    if (!this.encryptionKey) {
      console.warn('加密密钥未初始化，返回原始数据');
      return encryptedData;
    }

    try {
      const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      // 提取版本信息
      const version = data[data.length - 1];
      
      // 提取IV和加密数据
      const iv = data.slice(0, EncryptionManager.IV_LENGTH);
      const encrypted = data.slice(EncryptionManager.IV_LENGTH, data.length - 1);
      
      // 解密数据
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: EncryptionManager.ALGORITHM,
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
    await this.ensureInitialized();
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
    await this.ensureInitialized();
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

  async isEncryptionEnabled(): Promise<boolean> {
    await this.ensureInitialized();
    return this.encryptionKey !== null;
  }

  async getKeyVersion(): Promise<number> {
    await this.ensureInitialized();
    return this.keyVersion;
  }

  async clearKey(): Promise<void> {
    try {
      await SafeStorage.remove(['encryptionKey']);
      this.encryptionKey = null;
      this.keyVersion = 1;
      console.log('加密密钥已清除');
    } catch (error) {
      console.error('清除加密密钥失败:', error);
    }
  }

  // 健康检查
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // 检查是否已初始化
      if (!this.isInitialized) {
        issues.push('加密管理器未初始化');
      }

      // 检查加密密钥
      if (!this.encryptionKey) {
        issues.push('加密密钥不存在');
      }

      // 测试加密解密功能
      if (this.encryptionKey) {
        try {
          const testData = 'test';
          const encrypted = await this.encrypt(testData);
          const decrypted = await this.decrypt(encrypted);
          
          if (decrypted !== testData) {
            issues.push('加密解密测试失败');
          }
        } catch (error) {
          issues.push('加密解密测试异常: ' + error.message);
        }
      }

      return {
        healthy: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push('健康检查异常: ' + error.message);
      return {
        healthy: false,
        issues
      };
    }
  }
}

// 导出单例实例
export const encryptionManager = new EncryptionManager();
export default EncryptionManager;
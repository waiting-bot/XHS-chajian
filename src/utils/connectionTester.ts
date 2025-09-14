import type { FeishuConfig, ConnectionTestResult, FieldMappingSuggestion } from '../types/config';
import { FeishuClient } from '../api/feishu';
import { validateAccessToken, validateTableId } from './validation';

export class ConnectionTester {
  private client: FeishuClient;

  constructor() {
    this.client = new FeishuClient({});
  }

  // 全面连接测试
  async testConnection(config: FeishuConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 更新客户端配置
      await this.client.updateConfig(config);

      // 1. 验证Access Token格式
      const tokenValidation = validateAccessToken(config.accessToken);
      if (!tokenValidation.success) {
        errors.push(`Access Token格式错误: ${tokenValidation.errors.join(', ')}`);
        return this.createTestResult(false, 'Access Token格式验证失败', errors, warnings, Date.now() - startTime);
      }

      // 2. 验证表格ID格式
      const tableIdValidation = validateTableId(config.tableId);
      if (!tableIdValidation.success) {
        errors.push(`表格ID格式错误: ${tableIdValidation.errors.join(', ')}`);
        return this.createTestResult(false, '表格ID格式验证失败', errors, warnings, Date.now() - startTime);
      }

      // 3. 测试网络连接性
      const connectivityResult = await this.testConnectivity();
      if (!connectivityResult.success) {
        errors.push(`网络连接失败: ${connectivityResult.error}`);
        return this.createTestResult(false, '网络连接失败', errors, warnings, Date.now() - startTime);
      }

      // 4. 测试认证
      const authResult = await this.testAuthentication();
      if (!authResult.success) {
        errors.push(`认证失败: ${authResult.error}`);
        return this.createTestResult(false, '认证失败', errors, warnings, Date.now() - startTime);
      }

      // 5. 测试权限
      const permissionResult = await this.testPermissions();
      if (!permissionResult.success) {
        warnings.push(`权限测试失败: ${permissionResult.error}`);
      }

      // 6. 测试表格访问
      const tableAccessResult = await this.testTableAccess();
      if (!tableAccessResult.success) {
        errors.push(`表格访问失败: ${tableAccessResult.error}`);
        return this.createTestResult(false, '表格访问失败', errors, warnings, Date.now() - startTime);
      }

      // 7. 测试数据操作
      const dataOperationResult = await this.testDataOperations();
      if (!dataOperationResult.success) {
        warnings.push(`数据操作测试失败: ${dataOperationResult.error}`);
      }

      const responseTime = Date.now() - startTime;

      // 检查响应时间
      if (responseTime > 5000) {
        warnings.push('API响应时间较长，可能影响性能');
      }

      return this.createTestResult(
        true,
        '连接测试成功',
        errors,
        warnings,
        responseTime,
        {
          connectivity: connectivityResult.success,
          authentication: authResult.success,
          permissions: permissionResult.success,
          tableAccess: tableAccessResult.success,
          responseTime
        }
      );

    } catch (error) {
      return this.createTestResult(
        false,
        `连接测试异常: ${error instanceof Error ? error.message : '未知错误'}`,
        errors,
        warnings,
        Date.now() - startTime
      );
    }
  }

  // 测试网络连接性
  private async testConnectivity(): Promise<{ success: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://open.feishu.cn', {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络连接失败' };
    }
  }

  // 测试认证
  private async testAuthentication(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.getAccessToken();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '认证失败' };
    }
  }

  // 测试权限
  private async testPermissions(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.client.getAccessToken();
      
      // 测试获取应用信息
      const response = await fetch(`${this.client.getConfig().baseUrl}/open-apis/authen/v1/user_info`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: `权限检查失败: ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '权限测试失败' };
    }
  }

  // 测试表格访问
  private async testTableAccess(): Promise<{ success: boolean; error?: string }> {
    try {
      const fields = await this.client.getTableFields();
      if (fields && fields.length > 0) {
        return { success: true };
      } else {
        return { success: false, error: '表格为空或无法访问' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '表格访问失败' };
    }
  }

  // 测试数据操作
  private async testDataOperations(): Promise<{ success: boolean; error?: string }> {
    try {
      // 测试创建记录（使用测试数据）
      const testRecord = {
        fields: {
          测试字段: '测试数据',
          创建时间: new Date().toISOString()
        }
      };

      const result = await this.client.createRecord(testRecord);
      
      // 删除测试记录
      if (result.record_id) {
        try {
          // 注意：这里需要根据实际API实现删除操作
          // await this.client.deleteRecord(result.record_id)
        } catch (deleteError) {
          console.warn('删除测试记录失败:', deleteError);
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '数据操作测试失败' };
    }
  }

  // 验证Access Token
  async validateAccessToken(token: string): Promise<{ valid: boolean; errors: string[]; expiresAt?: number }> {
    const errors: string[] = [];

    // 基础格式验证
    const formatValidation = validateAccessToken(token);
    if (!formatValidation.success) {
      errors.push(...formatValidation.errors);
    }

    // 尝试使用token
    try {
      const tempClient = new FeishuClient({ accessToken: token });
      await tempClient.getAccessToken();
      
      // 检查token是否过期（这里需要根据飞书API的实际响应来判断）
      // 暂时返回有效，具体过期检查需要实现token解析逻辑
      
      return {
        valid: errors.length === 0,
        errors,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000 // 假设2小时后过期
      };
    } catch (error) {
      errors.push(`Token验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return { valid: false, errors };
    }
  }

  // 验证表格ID
  async validateTableId(tableId: string, baseUrl: string = 'https://open.feishu.cn'): Promise<{ valid: boolean; errors: string[]; tableInfo?: any }> {
    const errors: string[] = [];

    // 基础格式验证
    const formatValidation = validateTableId(tableId);
    if (!formatValidation.success) {
      errors.push(...formatValidation.errors);
    }

    // 尝试访问表格
    try {
      const tempClient = new FeishuClient({ tableId, baseUrl });
      const fields = await tempClient.getTableFields();
      
      return {
        valid: errors.length === 0,
        errors,
        tableInfo: {
          fieldCount: fields.length,
          fieldTypes: fields.map(f => f.type)
        }
      };
    } catch (error) {
      errors.push(`表格ID验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return { valid: false, errors };
    }
  }

  // 自动检测字段映射
  async detectFieldMapping(tableId: string, baseUrl: string = 'https://open.feishu.cn'): Promise<FieldMappingSuggestion[]> {
    try {
      const tempClient = new FeishuClient({ tableId, baseUrl });
      const fields = await tempClient.getTableFields();
      
      const suggestions: FieldMappingSuggestion[] = [];
      
      // 预定义的字段映射规则
      const mappingRules = [
        { source: 'title', patterns: ['标题', 'title', '名称', 'name', '主题'] },
        { source: 'author', patterns: ['作者', 'author', '用户', 'user', '发布者'] },
        { source: 'content', patterns: ['正文', 'content', '内容', '描述', 'description'] },
        { source: 'tags', patterns: ['标签', 'tags', '分类', 'category'] },
        { source: 'images', patterns: ['图片', 'images', '照片', 'photo'] },
        { source: 'video', patterns: ['视频', 'video', '影片'] },
        { source: 'likes', patterns: ['点赞', 'likes', '喜欢', '赞'] },
        { source: 'collects', patterns: ['收藏', 'collects', '收藏数'] },
        { source: 'comments', patterns: ['评论', 'comments', '回复'] },
        { source: 'url', patterns: ['链接', 'url', '网址'] },
        { source: 'createTime', patterns: ['创建时间', 'create', 'time', '日期', 'date'] }
      ];

      // 匹配字段
      for (const rule of mappingRules) {
        const matchedField = fields.find(field => {
          const fieldName = field.field_name.toLowerCase();
          return rule.patterns.some(pattern => 
            fieldName.includes(pattern.toLowerCase()) || 
            pattern.toLowerCase().includes(fieldName)
          );
        });

        if (matchedField) {
          suggestions.push({
            sourceField: rule.source as any,
            targetField: matchedField.field_name,
            confidence: this.calculateConfidence(rule.source, matchedField.field_name),
            reason: `字段名匹配: ${matchedField.field_name}`
          });
        }
      }

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('字段映射检测失败:', error);
      return [];
    }
  }

  // 计算匹配置信度
  private calculateConfidence(sourceField: string, targetField: string): number {
    const sourceLower = sourceField.toLowerCase();
    const targetLower = targetField.toLowerCase();
    
    // 完全匹配
    if (sourceLower === targetLower) {
      return 1.0;
    }
    
    // 包含关系
    if (targetLower.includes(sourceLower) || sourceLower.includes(targetLower)) {
      return 0.8;
    }
    
    // 常见映射
    const commonMappings = {
      'title': ['标题', '名称'],
      'author': ['作者', '用户'],
      'content': ['正文', '内容'],
      'createTime': ['创建时间', '时间', '日期']
    };
    
    if (commonMappings[sourceField as keyof typeof commonMappings]?.includes(targetField)) {
      return 0.9;
    }
    
    // 默认置信度
    return 0.5;
  }

  // 创建测试结果
  private createTestResult(
    success: boolean,
    message: string,
    errors: string[],
    warnings: string[],
    responseTime: number,
    details?: ConnectionTestResult['details']
  ): ConnectionTestResult {
    return {
      success,
      message,
      details: details || {
        connectivity: false,
        authentication: false,
        permissions: false,
        tableAccess: false,
        responseTime
      },
      errors,
      warnings
    };
  }

  // 获取连接建议
  getConnectionSuggestions(result: ConnectionTestResult): string[] {
    const suggestions: string[] = [];

    if (!result.success) {
      suggestions.push('请检查网络连接');
      suggestions.push('请确认Access Token是否正确且未过期');
      suggestions.push('请确认表格ID是否正确');
      suggestions.push('请确认应用权限设置');
    } else {
      if (result.details.responseTime > 3000) {
        suggestions.push('API响应时间较长，建议优化网络环境');
      }
      
      if (!result.details.permissions) {
        suggestions.push('应用权限不足，请在飞书开发者后台检查权限设置');
      }
    }

    return suggestions;
  }
}

// 导出单例实例
export const connectionTester = new ConnectionTester();
export default ConnectionTester;
# 飞书配置示例

本文档提供了小红书笔记采集扩展的飞书配置示例和最佳实践。

## 基础配置示例

### 完整配置模板

```json
{
  "feishuConfigs": [
    {
      "id": "config_001",
      "name": "生产环境配置",
      "appId": "cli_xxxxxxxxxxxx",
      "appSecret": "your_app_secret_here",
      "accessToken": "pat_xxxxxxxxxxxx",
      "tableId": "bascnxxxxxxxxxx",
      "baseUrl": "https://open.feishu.cn",
      "isActive": true,
      "createdAt": 1634567890000,
      "updatedAt": 1634567890000
    }
  ],
  "activeConfigId": "config_001",
  "tableDataConfig": {
    "fieldMapping": {
      "title": "标题",
      "author": "作者",
      "content": "正文",
      "tags": "标签",
      "images": "图片",
      "video": "视频",
      "likes": "点赞数",
      "collects": "收藏数",
      "comments": "评论数",
      "url": "链接",
      "createTime": "创建时间"
    },
    "tableId": "bascnxxxxxxxxxx",
    "autoUploadFiles": true,
    "maxFileSize": 10485760,
    "allowedTypes": ["image/jpeg", "image/png", "video/mp4"],
    "enableBatchProcessing": true,
    "maxConcurrentUploads": 3
  },
  "appConfig": {
    "version": "1.2.0",
    "language": "zh-CN",
    "theme": "auto",
    "autoBackup": true,
    "backupInterval": 24,
    "maxBackups": 10,
    "debugMode": false,
    "statistics": {
      "totalProcessed": 0,
      "successCount": 0,
      "failureCount": 0,
      "lastProcessedAt": null
    }
  },
  "encryption": {
    "enabled": true,
    "algorithm": "AES-256-GCM",
    "keyVersion": 1
  }
}
```

## 飞书应用配置

### 1. 创建飞书应用

1. 登录[飞书开放平台](https://open.feishu.cn/)
2. 创建应用 -> 选择"企业自建应用"
3. 填写应用信息：
   - 应用名称：小红书笔记采集器
   - 应用描述：用于采集小红书笔记到飞书多维表格
   - 应用图标：建议使用小红书相关图标

### 2. 配置应用权限

在应用管理页面添加以下权限：

| 权限名称      | 权限码           | 用途               |
| ------------- | ---------------- | ------------------ |
| 多维表格-表格 | `bitable:table`  | 读取和写入表格数据 |
| 多维表格-字段 | `bitable:field`  | 获取表格字段信息   |
| 多维表格-记录 | `bitable:record` | 创建和读取记录     |
| 云文档-文件   | `drive:file`     | 上传图片和视频文件 |
| 用户信息-用户 | `user:profile`   | 获取用户信息       |

### 3. 获取应用凭证

在应用管理页面的"凭证与基础信息"中获取：

- **App ID**: `cli_xxxxxxxxxxxx`
- **App Secret**: `your_app_secret_here`
- **Access Token**: `pat_xxxxxxxxxxxx`

### 4. 创建多维表格

1. 在飞书中创建新的多维表格
2. 设计表格结构（推荐字段）：

| 字段名   | 字段类型 | 说明         |
| -------- | -------- | ------------ |
| 标题     | 文本     | 笔记标题     |
| 作者     | 文本     | 笔记作者     |
| 正文     | 多行文本 | 笔记正文内容 |
| 标签     | 多选     | 笔记标签     |
| 图片     | 附件     | 笔记图片     |
| 视频     | 附件     | 笔记视频     |
| 点赞数   | 数字     | 点赞数量     |
| 收藏数   | 数字     | 收藏数量     |
| 评论数   | 数字     | 评论数量     |
| 链接     | 超链接   | 原始链接     |
| 创建时间 | 日期     | 笔记创建时间 |

### 5. 获取表格ID

在多维表格的URL中找到表格ID：

```
https://example.feishu.cn/baserect/v1/bascnxxxxxxxxxx
                                    ^^^^^^^^^^^^^^
                                    表格ID
```

## 环境配置示例

### 开发环境配置

```json
{
  "feishuConfigs": [
    {
      "id": "dev_config_001",
      "name": "开发环境配置",
      "appId": "cli_dev_xxxxxxxxxxxx",
      "appSecret": "dev_app_secret_here",
      "accessToken": "pat_dev_xxxxxxxxxxxx",
      "tableId": "bascn_devxxxxxxxxxx",
      "baseUrl": "https://open.feishu.cn",
      "isActive": true,
      "createdAt": 1634567890000,
      "updatedAt": 1634567890000
    }
  ],
  "activeConfigId": "dev_config_001",
  "tableDataConfig": {
    "fieldMapping": {
      "title": "标题",
      "author": "作者",
      "content": "正文",
      "tags": "标签",
      "images": "图片",
      "video": "视频",
      "likes": "点赞数",
      "collects": "收藏数",
      "comments": "评论数",
      "url": "链接",
      "createTime": "创建时间"
    },
    "tableId": "bascn_devxxxxxxxxxx",
    "autoUploadFiles": true,
    "maxFileSize": 5242880, // 5MB
    "allowedTypes": ["image/jpeg", "image/png"],
    "enableBatchProcessing": false,
    "maxConcurrentUploads": 1
  },
  "appConfig": {
    "version": "1.2.0-dev",
    "language": "zh-CN",
    "theme": "light",
    "autoBackup": true,
    "backupInterval": 1, // 1小时
    "maxBackups": 5,
    "debugMode": true,
    "statistics": {
      "totalProcessed": 0,
      "successCount": 0,
      "failureCount": 0,
      "lastProcessedAt": null
    }
  },
  "encryption": {
    "enabled": true,
    "algorithm": "AES-256-GCM",
    "keyVersion": 1
  }
}
```

### 生产环境配置

```json
{
  "feishuConfigs": [
    {
      "id": "prod_config_001",
      "name": "生产环境配置",
      "appId": "cli_prod_xxxxxxxxxxxx",
      "appSecret": "prod_app_secret_here",
      "accessToken": "pat_prod_xxxxxxxxxxxx",
      "tableId": "bascn_prodxxxxxxxxxx",
      "baseUrl": "https://open.feishu.cn",
      "isActive": true,
      "createdAt": 1634567890000,
      "updatedAt": 1634567890000
    },
    {
      "id": "prod_config_002",
      "name": "生产环境备份配置",
      "appId": "cli_prod_backup_xxxxxxxxxxxx",
      "appSecret": "prod_backup_app_secret_here",
      "accessToken": "pat_prod_backup_xxxxxxxxxxxx",
      "tableId": "bascn_prod_backupxxxxxxxxxx",
      "baseUrl": "https://open.feishu.cn",
      "isActive": false,
      "createdAt": 1634567890000,
      "updatedAt": 1634567890000
    }
  ],
  "activeConfigId": "prod_config_001",
  "tableDataConfig": {
    "fieldMapping": {
      "title": "标题",
      "author": "作者",
      "content": "正文",
      "tags": "标签",
      "images": "图片",
      "video": "视频",
      "likes": "点赞数",
      "collects": "收藏数",
      "comments": "评论数",
      "url": "链接",
      "createTime": "创建时间"
    },
    "tableId": "bascn_prodxxxxxxxxxx",
    "autoUploadFiles": true,
    "maxFileSize": 10485760, // 10MB
    "allowedTypes": ["image/jpeg", "image/png", "video/mp4", "video/mov"],
    "enableBatchProcessing": true,
    "maxConcurrentUploads": 5
  },
  "appConfig": {
    "version": "1.2.0",
    "language": "zh-CN",
    "theme": "auto",
    "autoBackup": true,
    "backupInterval": 24, // 24小时
    "maxBackups": 30,
    "debugMode": false,
    "statistics": {
      "totalProcessed": 1250,
      "successCount": 1185,
      "failureCount": 65,
      "lastProcessedAt": 1634567890000
    }
  },
  "encryption": {
    "enabled": true,
    "algorithm": "AES-256-GCM",
    "keyVersion": 1
  }
}
```

## 字段映射配置

### 标准字段映射

```json
{
  "fieldMapping": {
    "title": "标题",
    "author": "作者",
    "content": "正文",
    "tags": "标签",
    "images": "图片",
    "video": "视频",
    "likes": "点赞数",
    "collects": "收藏数",
    "comments": "评论数",
    "url": "链接",
    "createTime": "创建时间"
  }
}
```

### 自定义字段映射

如果您的飞书表格使用不同的字段名称，可以自定义映射：

```json
{
  "fieldMapping": {
    "title": "笔记标题",
    "author": "发布者",
    "content": "笔记内容",
    "tags": "关键词",
    "images": "配图",
    "video": "视频文件",
    "likes": "点赞",
    "collects": "收藏",
    "comments": "评论",
    "url": "原文链接",
    "createTime": "发布时间"
  }
}
```

## 配置验证

### 配置检查清单

- [ ] App ID格式正确（以`cli_`开头）
- [ ] App Secret不为空
- [ ] Access Token格式正确（以`pat_`开头）
- [ ] 表格ID格式正确（以`bascn`开头）
- [ ] 字段映射与实际表格字段匹配
- [ ] 文件上传大小限制合理
- [ ] 并发上传数量设置合理

### 常见配置错误

1. **Access Token过期**
   - 症状：连接测试失败
   - 解决：在飞书开放平台重新生成token

2. **表格权限不足**
   - 症状：无法读取表格字段
   - 解决：检查应用权限配置

3. **字段映射错误**
   - 症状：数据写入失败
   - 解决：确保字段名称与表格字段完全匹配

## 配置管理

### 导出配置

在扩展设置页面点击"导出配置"，可以导出当前配置：

```json
{
  "exportType": "config",
  "version": "1.2.0",
  "exportedAt": 1634567890000,
  "config": {
    // 配置内容
  }
}
```

### 导入配置

在扩展设置页面点击"导入配置"，选择之前导出的配置文件。

### 配置备份

建议定期备份配置：

1. 手动导出配置文件
2. 保存到安全位置
3. 记录配置版本信息

## 安全注意事项

1. **敏感信息保护**：
   - 不要在公共场所分享配置文件
   - 定期更换Access Token
   - 使用加密存储选项

2. **权限最小化**：
   - 只申请必要的权限
   - 定期审查应用权限

3. **访问控制**：
   - 限制飞书表格的访问权限
   - 监控数据访问日志

## 故障排除

### 连接测试失败

1. 检查网络连接
2. 验证Access Token有效性
3. 确认应用权限配置
4. 查看飞书服务状态

### 数据写入失败

1. 检查字段映射配置
2. 验证表格字段类型
3. 确认数据格式正确
4. 查看详细错误信息

### 文件上传失败

1. 检查文件大小限制
2. 验证文件类型支持
3. 确认存储空间充足
4. 检查网络连接状态

## 相关文档

- [Chrome扩展存储问题修复指南](./storage-fix-guide.md)
- [技术实现方案](./technical-plan.md)
- [MVP产品需求](./mvp-prd.md)
- [实施路线图](./implementation-roadmap.md)

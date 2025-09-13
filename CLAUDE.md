# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个浏览器插件项目，用于采集小红书笔记数据并写入飞书多维表格。项目目前处于初始化阶段，只有需求文档，需要从零开始实现。

## 技术栈

- **插件技术**: Chrome/Edge 插件 (Manifest V3)
- **前端**: HTML/JavaScript/CSS
- **存储**: Chrome 本地存储 (chrome.storage.local)
- **API**: 飞书文件上传和表格写入 API

## 核心功能模块

### 1. 页面检测模块
- 检测当前页面是否为小红书笔记详情页
- 自动触发插件操作面板

### 2. DOM 采集模块
- 采集笔记标题、作者、正文、标签
- 获取点赞/收藏/评论数
- 抓取低清图片和视频文件

### 3. 用户配置管理
- 飞书 Access Token、表格 ID、列映射配置
- 多配置管理（新增、修改、删除、选择）
- 配置持久化存储

### 4. 文件上传模块
- 图片/视频转 Blob/Base64
- 调用飞书文件上传接口
- 获取文件 ID

### 5. 数据写入模块
- 组装 JSON 数据
- 调用飞书表格写入 API
- 错误处理和状态提示

## 开发命令

```bash
# 开发环境（后续添加）
npm run dev

# 构建插件（后续添加）
npm run build

# 打包插件（后续添加）
npm run package
```

## 文件结构规划

```
XHS chajian/
├── manifest.json          # 插件配置文件
├── popup/                 # 弹窗界面
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/               # 内容脚本
│   ├── content.js
│   └── selectors.js       # DOM 选择器配置
├── background/            # 后台脚本
│   └── background.js
├── lib/                   # 工具库
│   ├── feishu-api.js      # 飞书 API 封装
│   ├── storage.js         # 存储管理
│   └── utils.js           # 工具函数
└── assets/                # 静态资源
    └── icons/
```

## 重要注意事项

### DOM 采集风险
- 小红书页面结构变化可能导致采集失效
- 需要定期更新 DOM 选择器配置

### 性能考虑
- MVP 阶段仅支持单条笔记采集
- 限制低清图片和小视频上传，避免性能问题

### 安全性
- Access Token 存储在浏览器本地，不上传到服务器
- 需要提醒用户妥善保管个人访问令牌

## 开发优先级

1. **基础框架**: Manifest V3 插件结构
2. **页面检测**: 识别小红书笔记页面
3. **DOM 采集**: 实现数据抓取功能
4. **配置管理**: 飞书配置界面和存储
5. **文件上传**: 图片视频上传功能
6. **数据写入**: 飞书表格数据写入
7. **错误处理**: 完善异常处理和用户提示
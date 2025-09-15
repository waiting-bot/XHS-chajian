# 小红书笔记采集器

一个用于采集小红书笔记数据并写入飞书多维表格的浏览器扩展。

## 功能特性

- 📸 自动采集小红书笔记数据（标题、作者、正文、标签、图片/视频）
- 📊 将采集数据写入飞书多维表格
- 🔧 支持多配置管理
- 🎯 智能页面检测
- 💾 本地数据存储

## 技术栈

- **扩展框架**: Chrome Extension (Manifest V3)
- **构建工具**: Vite + CRXJS
- **开发语言**: TypeScript
- **代码规范**: ESLint + Prettier
- **包管理**: pnpm

## 开发环境

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建项目

```bash
pnpm build
```

### 代码检查

```bash
pnpm lint        # 代码检查
pnpm format      # 代码格式化
```

## 项目结构

```
src/
├── manifest.json          # 扩展配置文件
├── popup/                 # 弹窗界面
│   ├── popup.html
│   ├── popup.ts
│   └── popup.css
├── content/               # 内容脚本
│   ├── content.ts
│   └── content.css
├── background/            # 后台脚本
│   └── background.ts
├── lib/                   # 工具库
│   ├── feishu-api.ts      # 飞书 API 封装
│   ├── storage.ts         # 存储管理
│   └── utils.ts           # 工具函数
└── assets/                # 静态资源
    └── icon.svg
```

## 扩展安装

1. 克隆项目并安装依赖
2. 运行 `pnpm build` 构建扩展
3. 打开 Chrome 浏览器，进入 `chrome://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择 `dist` 目录

## 使用说明

### 基本使用

1. 打开小红书笔记页面
2. 点击扩展图标打开弹窗
3. 配置飞书设置（首次使用）
4. 点击"采集当前笔记"按钮

### 配置飞书

1. 获取飞书 Access Token
2. 创建多维表格并获取表格 ID
3. 配置字段映射关系

## 开发指南

### 代码规范

项目使用 ESLint + Prettier 进行代码规范管理，提交代码时会自动进行格式化。

### Git 提交规范

使用 Husky 进行提交检查，确保代码质量。

### 扩展开发

- **Manifest V3**: 使用最新的 Chrome 扩展规范
- **TypeScript**: 全面的类型支持
- **模块化**: 清晰的代码结构

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

ISC

## 注意事项

- 仅支持小红书笔记页面采集
- 需要配置有效的飞书 Access Token
- 数据存储在浏览器本地，注意备份数据

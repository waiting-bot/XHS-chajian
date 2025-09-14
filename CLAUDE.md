# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个现代化的Chrome浏览器插件项目，用于采集小红书笔记详情页的数据并写入飞书多维表格。项目采用Vite + CRXJS构建系统，支持TypeScript和热重载开发。

## 技术栈

- **构建工具**: Vite 7.x + CRXJS Vite Plugin
- **插件框架**: Manifest V3 + Service Worker
- **开发语言**: TypeScript + ES6+
- **样式**: CSS (可扩展为CSS Modules/UnoCSS)
- **包管理**: pnpm
- **代码质量**: ESLint + Prettier + Husky

## 开发命令

```bash
# 启动开发服务器 (支持HMR热重载)
pnpm dev

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview

# 代码检查和格式化
pnpm lint        # ESLint 检查
pnpm format      # Prettier 格式化

# Git hooks 设置
pnpm prepare     # 初始化 Husky
```

## 项目架构

### 核心目录结构
```
src/
├── manifest.json          # 插件配置文件
├── popup/                 # 弹窗界面
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/               # 内容脚本
│   ├── content.js
│   └── content.css
├── background/            # Service Worker
│   └── background.js
└── assets/                # 静态资源
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

### 关键配置
- **构建配置**: `vite.config.ts` - Vite + CRXJS 构建配置
- **TypeScript配置**: `tsconfig.json` + `tsconfig.node.json`
- **代码质量**: `.eslintrc.json` + `.prettierrc`
- **Git Hooks**: `.husky/` - 自动化代码检查

## 核心功能模块

### 1. 页面检测模块
- 检测小红书笔记页面: `https://www.xiaohongshu.com/explore/*`
- Content Script自动注入和页面分析
- 向Popup发送页面状态信息

### 2. 数据采集模块
- DOM选择器配置化采集
- 支持字段: 标题、作者、正文、标签、点赞/收藏/评论数
- 图片和视频文件抓取
- 容错处理和fallback机制

### 3. 配置管理模块
- 飞书配置的多实例管理
- Chrome Storage API持久化存储
- 配置验证和测试连接功能
- 动态列映射配置

### 4. 文件处理模块
- 图片/视频文件转换为Blob
- 飞书文件上传API调用
- 文件大小和类型验证
- 上传进度和错误处理

### 5. 数据写入模块
- 飞书多维表格数据格式组装
- 批量数据写入API调用
- 错误重试和状态反馈

## 开发工作流

### 开发环境设置
1. 安装依赖: `pnpm install`
2. 启动开发服务器: `pnpm dev`
3. Chrome扩展管理页面加载 `dist` 目录
4. 代码修改自动热重载

### 代码质量保证
- **提交检查**: Husky + lint-staged 自动检查
- **代码格式**: Prettier 统一代码风格
- **类型安全**: TypeScript 编译时检查
- **代码规范**: ESLint 规则检查

### 构建和部署
1. 代码检查: `pnpm lint && pnpm format`
2. 生产构建: `pnpm build`
3. 输出目录: `dist/` (可直接加载到Chrome)

## 重要注意事项

### 页面结构风险
- 小红书页面结构变化可能导致采集失效
- 选择器配置化设计，支持快速更新
- 建议定期验证采集功能

### 性能优化
- MVP阶段专注单条笔记采集
- 限制文件大小和数量
- 使用Service Worker处理后台任务

### 安全性
- Access Token存储在Chrome本地存储
- 不上传任何用户数据到外部服务器
- 建议用户定期更新飞书访问令牌

## 浏览器兼容性
- **Chrome 88+** (主要支持)
- **Edge 88+** (兼容支持)
- **Firefox** (需要webextension-polyfill)

## 开发优先级

1. **基础框架** - Manifest V3 + Vite构建系统
2. **页面检测** - 小红书笔记页面识别
3. **数据采集** - DOM数据抓取实现
4. **配置管理** - 飞书配置界面和存储
5. **文件上传** - 图片视频上传功能
6. **数据写入** - 飞书表格数据写入
7. **错误处理** - 异常处理和用户提示
8. **测试覆盖** - 单元测试和E2E测试
- 接下来每完成一项任务，都自动更新到implementation-roadmap.md里，标记完完成状态
# 文件清理记录

## 已清理的文件

### 已标记为过时的文件

- `src/background/background.js` → `src/background/background.js.deprecated`
  - 原因: 被 TypeScript 版本替代
  - 状态: 保留为参考，可删除

- `src/content/content.js` → `src/content/content.js.deprecated`
  - 原因: 被 TypeScript 版本替代
  - 状态: 保留为参考，可删除

### 已重命名的配置文件

- `vite.config.ts` → `vite.config.ts.crx-original`
  - 原因: CRXJS 配置有问题，使用简化版本
  - 状态: 保留为 CRXJS 配置参考

- `vite.config.simple.ts` → `vite.config.ts`
  - 原因: 简化配置工作正常，成为主要配置
  - 状态: 当前使用中

## 当前文件结构

### 源文件 (src/)

- `src/background/background.ts` - Service Worker (TypeScript)
- `src/content/content.ts` - Content Script (TypeScript)
- `src/content/content.css` - Content Script 样式
- `src/popup/popup.ts` - Popup 脚本 (TypeScript)
- `src/popup/popup.html` - Popup 界面
- `src/popup/popup.css` - Popup 样式
- `src/manifest.json` - 扩展配置
- `src/assets/` - 静态资源

### 配置文件 (根目录)

- `vite.config.ts` - 主要构建配置
- `vite.config.ts.crx-original` - CRXJS 原始配置 (保留)
- `tsconfig.json` - TypeScript 配置
- `tsconfig.node.json` - Node.js TypeScript 配置
- `package.json` - 项目配置

### 构建输出 (dist/)

- `dist/manifest.json` - 扩展清单
- `dist/background/background.js` - 构建后的 Service Worker
- `dist/content/content.js` - 构建后的 Content Script
- `dist/content/content.css` - Content Script 样式
- `dist/popup/popup.js` - 构建后的 Popup 脚本
- `dist/popup/popup.html` - Popup 界面
- `dist/icon*.svg` - 图标文件

## 清理建议

### 可以安全删除的文件

- `src/background/background.js.deprecated`
- `src/content/content.js.deprecated`

### 需要保留的文件

- `vite.config.ts.crx-original` - 用于未来 CRXJS 配置参考

## 构建流程

当前使用简化的 Vite 配置进行构建：

1. `pnpm clean` - 清理构建目录
2. `pnpm build` - 构建所有文件
3. 自动复制 HTML/CSS/manifest 到构建目录

## 后续注意事项

1. 在创建新文件时，及时清理旧版本
2. 更改配置文件时，备份旧版本并标注
3. 定期检查 `.deprecated` 文件，确认可以删除
4. 保持文件结构的一致性

import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        'content/content': './src/content/content.ts',
        'background/background': './src/background/background.ts',
        'popup/popup': './src/popup/popup.ts',
        'options/options': './src/options/options.ts',
        'popup/popup.html': './src/popup/popup.html',
        'options/options.html': './src/options/options.html',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: assetInfo => {
          if (assetInfo.name.endsWith('.css')) {
            return 'content/[name][extname]'
          }
          return 'assets/[name].[ext]'
        },
        format: 'es',
        globals: {
          chrome: 'chrome'
        }
      },
    },
  },
  publicDir: 'src/assets',
  plugins: [
    {
      name: 'copy-css-files',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'content/content.css',
          source: require('fs').readFileSync(
            './src/content/content.css',
            'utf8'
          ),
        })
      },
    },
    {
      name: 'copy-manifest',
      generateBundle() {
        const manifest = require('./src/manifest.json')
        // 修正路径为构建后的正确路径
        const fixedManifest = {
          ...manifest,
          background: {
            service_worker: 'background/background.js',
            type: 'module'
          },
          action: {
            ...manifest.action,
            default_popup: 'src/popup/popup.html'
          },
          options_ui: {
            ...manifest.options_ui,
            page: 'src/options/options.html'
          },
          web_accessible_resources: [
            {
              resources: ['src/popup/popup.html'],
              matches: ['*://*.xiaohongshu.com/*']
            }
          ]
        }
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: JSON.stringify(fixedManifest, null, 2),
        })
      },
    },
  ],
  // 禁用内容脚本的HMR（开发时）
  server: {
    hmr: false
  }
})

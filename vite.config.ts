import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'content/content': './src/content/content.ts',
        'background/background': './src/background/background.ts',
        'popup/popup': './src/popup/popup.ts',
        'popup/popup.html': './src/popup/popup.html',
        'options/options': './src/options/options.ts',
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
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: JSON.stringify(require('./src/manifest.json'), null, 2),
        })
      },
    },
  ],
  // 禁用内容脚本的HMR（开发时）
  server: {
    hmr: false
  }
})

// eslint.config.js
import globals from 'globals'
import pluginJs from '@eslint/js'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginTypeScript from '@typescript-eslint/eslint-plugin'
import parserTypeScript from '@typescript-eslint/parser'

export default [
  // 1. 全局忽略配置
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'vite.config.ts'],
  },

  // 2. JavaScript 文件配置（包括构建后的 JS 文件）
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        window: 'readonly',
        document: 'readonly',
        Image: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        process: 'readonly',
        NodeJS: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-console': 'warn',
      'no-unused-vars': 'warn',
    },
  },

  // 3. TypeScript 源文件配置
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: parserTypeScript,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        window: 'readonly',
        document: 'readonly',
        Image: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        process: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': pluginTypeScript,
    },
    rules: {
      ...pluginTypeScript.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },

  // 4. React 配置（如果项目使用 React）
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    settings: {
      react: {
        version: 'detect', // 自动检测 React 版本
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      'react/prop-types': 'off', // 关闭 prop-types 检查（TS 项目可禁用）
    },
  },

  // 5. 基础 JS 规则（继承官方推荐规则）
  pluginJs.configs.recommended,

  // 6. 通用自定义规则（覆盖所有文件）
  {
    rules: {
      'no-console': 'warn', // 允许 console 但警告
      indent: ['error', 2], // 强制 2 空格缩进
      quotes: ['error', 'single'], // 强制单引号
      semi: ['error', 'always'], // 强制语句结尾加分号
      'no-unused-vars': 'warn', // 未使用的变量警告（不阻断提交）
    },
  },
]

// eslint.config.js
import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginTypeScript from "@typescript-eslint/eslint-plugin";
import parserTypeScript from "@typescript-eslint/parser";

export default [
  // 1. 配置文件适用范围（可根据项目调整）
  {
    files: ["**/*.{js,jsx,ts,tsx}"], // 检查所有 JS/JSX/TS/TSX 文件
    ignores: ["node_modules/**", "dist/**", "build/**"], // 忽略无需检查的目录
  },

  // 2. 基础 JS 规则（继承官方推荐规则）
  pluginJs.configs.recommended,

  // 3. TypeScript 配置（如果项目使用 TS）
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: parserTypeScript, // TS 解析器
      parserOptions: {
        project: "./tsconfig.json", // 关联 TS 配置文件（必填）
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": pluginTypeScript,
    },
    rules: {
      ...pluginTypeScript.configs.recommended.rules,
      // 自定义 TS 规则（示例）
      "@typescript-eslint/no-explicit-any": "warn", // 允许 any 类型但警告
    },
  },

  // 4. React 配置（如果项目使用 React）
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    settings: {
      react: {
        version: "detect", // 自动检测 React 版本
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      // 自定义 React 规则（示例）
      "react/prop-types": "off", // 关闭 prop-types 检查（TS 项目可禁用）
    },
  },

  // 5. 通用自定义规则（覆盖所有文件）
  {
    rules: {
      "no-console": "warn", // 允许 console 但警告
      "indent": ["error", 2], // 强制 2 空格缩进
      "quotes": ["error", "single"], // 强制单引号
      "semi": ["error", "always"], // 强制语句结尾加分号
      "no-unused-vars": "warn", // 未使用的变量警告（不阻断提交）
    },
  },
];
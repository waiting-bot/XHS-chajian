import { test, expect } from '@playwright/test'

test.describe('Chrome Extension E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 由于是 Chrome 扩展测试，我们需要模拟扩展环境
    // 这里创建一个基础的测试页面
  })

  test('basic page load', async ({ page }) => {
    await page.goto('/')
    
    // 验证页面加载成功
    await expect(page).toHaveTitle(/XHS chajian/)
  })

  test('extension popup functionality', async ({ page }) => {
    // 模拟扩展弹窗功能
    await page.goto('/')
    
    // 测试基本交互
    const testButton = page.locator('button:has-text("Test")')
    if (await testButton.isVisible()) {
      await testButton.click()
      await expect(page.locator('.test-result')).toBeVisible()
    }
  })

  test('content script injection', async ({ page }) => {
    // 测试内容脚本注入功能
    await page.goto('/')
    
    // 验证内容脚本是否正确注入
    const contentScriptElement = page.locator('[data-extension-loaded]')
    await expect(contentScriptElement).toBeVisible({ timeout: 5000 })
  })

  test('storage operations', async ({ page }) => {
    await page.goto('/')
    
    // 测试存储功能
    await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.set({ testKey: 'testValue' }, () => {
          chrome.storage.local.get(['testKey'], (result) => {
            resolve(result)
          })
        })
      })
    })
    
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['testKey'], (result) => {
          resolve(result)
        })
      })
    })
    
    expect(result).toEqual({ testKey: 'testValue' })
  })

  test('error handling', async ({ page }) => {
    await page.goto('/')
    
    // 测试错误处理
    const errorButton = page.locator('button:has-text("Trigger Error")')
    if (await errorButton.isVisible()) {
      await errorButton.click()
      
      // 验证错误被正确处理
      const errorMessage = page.locator('.error-message')
      await expect(errorMessage).toBeVisible()
      await expect(errorMessage).toContainText('error')
    }
  })
})
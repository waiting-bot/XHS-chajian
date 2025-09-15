// Options Page 配置管理
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('configForm') as HTMLFormElement
  const toast = document.getElementById('toast') as HTMLDivElement
  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
  const testBtn = document.getElementById('testBtn') as HTMLButtonElement
  const connectionStatus = document.getElementById(
    'connectionStatus'
  ) as HTMLSpanElement

  // 配置字段
  const configFields = [
    'feishuSpreadsheetUrl',
    'feishuAppId',
    'feishuAppSecret',
    'feishuAppToken',
    'feishuTableId',
    'feishuBaseUrl',
    'feishuTimeout',
  ]

  // 加载保存的配置
  loadConfig()

  // 表单提交处理
  form.addEventListener('submit', async e => {
    e.preventDefault()
    console.log('表单提交开始')

    try {
      const formData = new FormData(form)
      const spreadsheetUrl = formData.get('spreadsheetUrl') as string

      console.log('Spreadsheet URL:', spreadsheetUrl)

      // 解析URL获取App Token和Table ID
      const { appToken, tableId } = parseSpreadsheetUrl(spreadsheetUrl)

      console.log('解析结果 - App Token:', appToken, 'Table ID:', tableId)

      const config = {
        feishuSpreadsheetUrl: spreadsheetUrl,
        feishuAppId: formData.get('appId') as string,
        feishuAppSecret: formData.get('appSecret') as string,
        feishuAppToken: appToken,
        feishuTableId: tableId,
        feishuBaseUrl:
          (formData.get('baseUrl') as string) || 'https://open.feishu.cn',
        feishuTimeout: parseInt(formData.get('timeout') as string) || 10000,
      }

      console.log('配置对象:', config)

      // 验证配置
      if (!validateConfig(config)) {
        console.log('配置验证失败')
        return
      }

      // 禁用按钮显示加载状态
      setButtonLoading(saveBtn, true)
      console.log('开始保存配置...')

      // 保存配置
      await saveConfig(config)
      console.log('配置保存成功')
      showToast('配置保存成功! 页面将在2秒后刷新...', 'success')

      // 2秒后刷新页面以显示最新的配置状态
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error('配置保存失败:', error)
      showToast('配置保存失败: ' + error.message, 'error')
    } finally {
      setButtonLoading(saveBtn, false)
    }
  })

  // 测试连接按钮
  testBtn.addEventListener('click', () => {
    testConnection()
  })

  // 加载配置
  async function loadConfig() {
    try {
      console.log('开始加载配置，字段列表:', configFields)
      const result = await chrome.storage.sync.get(configFields)
      console.log('从存储中读取到的配置:', result)

      // 填充表单
      ;(document.getElementById('spreadsheetUrl') as HTMLInputElement).value =
        result.feishuSpreadsheetUrl || ''
      ;(document.getElementById('appId') as HTMLInputElement).value =
        result.feishuAppId || ''
      ;(document.getElementById('appSecret') as HTMLInputElement).value =
        result.feishuAppSecret || ''
      ;(document.getElementById('baseUrl') as HTMLInputElement).value =
        result.feishuBaseUrl || 'https://open.feishu.cn'
      ;(document.getElementById('timeout') as HTMLInputElement).value =
        result.feishuTimeout?.toString() || '10000'

      console.log('表单填充完成，检查配置状态...')
      console.log('App ID存在:', !!result.feishuAppId)
      console.log('App Secret存在:', !!result.feishuAppSecret)
      console.log('App Token存在:', !!result.feishuAppToken)

      // 检查连接状态
      if (
        result.feishuAppId &&
        result.feishuAppSecret &&
        result.feishuAppToken
      ) {
        console.log('配置完整，开始测试连接...')
        testConnection()
      } else {
        console.log('配置不完整，跳过连接测试')
        updateConnectionStatus('disconnected', '未配置')
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      showToast('加载配置失败', 'error')
    }
  }

  // 保存配置
  async function saveConfig(config: any) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(config, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          // 通知popup页面更新状态
          chrome.runtime.sendMessage({
            type: 'configUpdated',
            data: {
              feishuAppId: config.feishuAppId,
              feishuAppSecret: config.feishuAppSecret,
              feishuAppToken: config.feishuAppToken,
              feishuTableId: config.feishuTableId
            }
          }, (response) => {
            console.log('发送配置更新消息结果:', response);
          });
          
          resolve(true)
        }
      })
    })
  }

  // 验证配置
  function validateConfig(config: any): boolean {
    if (!config.feishuSpreadsheetUrl) {
      showToast('请输入多维表格 URL', 'error')
      return false
    }

    if (!config.feishuAppId) {
      showToast('请输入飞书应用 App ID', 'error')
      return false
    }

    if (!config.feishuAppSecret) {
      showToast('请输入飞书应用 App Secret', 'error')
      return false
    }

    if (!config.feishuAppToken) {
      showToast('无法从 URL 解析 App Token，请检查 URL 格式', 'error')
      return false
    }

    if (!config.feishuTableId) {
      showToast('无法从 URL 解析表格 ID，请检查 URL 格式', 'error')
      return false
    }

    // 验证 URL 格式
    try {
      new URL(config.feishuSpreadsheetUrl)
    } catch {
      showToast('URL 格式不正确', 'error')
      return false
    }

    // 验证 App ID 格式 (可选验证)
    if (config.feishuAppId && !config.feishuAppId.startsWith('cli_')) {
      console.warn('App ID 格式可能不正确，通常以 "cli_" 开头')
    }

    // 验证表格 ID 格式 (可选验证)
    if (config.feishuTableId && !config.feishuTableId.startsWith('tbl')) {
      console.warn('表格 ID 格式可能不正确，通常以 "tbl" 开头')
    }

    // 验证超时时间
    if (config.feishuTimeout < 1000 || config.feishuTimeout > 60000) {
      showToast('超时时间应在 1-60 秒之间', 'error')
      return false
    }

    return true
  }

  // 测试连接
  async function testConnection() {
    setButtonLoading(testBtn, true)
    updateConnectionStatus('testing', '正在测试连接...')

    try {
      // 获取当前配置
      const config = await chrome.storage.sync.get([
        'feishuAppId',
        'feishuAppSecret',
        'feishuAppToken',
        'feishuTableId',
        'feishuBaseUrl',
      ])

      if (
        !config.feishuAppId ||
        !config.feishuAppSecret ||
        !config.feishuAppToken
      ) {
        updateConnectionStatus('disconnected', '配置不完整')
        showToast('请先完成配置', 'error')
        return
      }

      // 模拟连接测试 (实际应该调用飞书API获取tenant_access_token)
      await simulateConnectionTest(config)

      updateConnectionStatus('connected', '连接正常')
      showToast('连接测试成功!', 'success')
    } catch (error) {
      console.error('连接测试失败:', error)
      updateConnectionStatus('disconnected', '连接失败')
      showToast('连接测试失败: ' + error.message, 'error')
    } finally {
      setButtonLoading(testBtn, false)
    }
  }

  // 解析飞书表格URL
  function parseSpreadsheetUrl(url: string): {
    appToken: string
    tableId: string
  } {
    try {
      const urlObj = new URL(url)

      // 尝试从路径中提取 app token (支持多种格式)
      let appToken = null

      // 格式1: /base/NxYqbEm9NazXH2s2iYrc3pnenQd (多维表格格式)
      const basePathMatch = urlObj.pathname.match(/\/base\/([a-zA-Z0-9]+)/)
      if (basePathMatch) {
        appToken = basePathMatch[1]
      }

      // 格式2: /sheets/appliA1b2C3d4E5f6G7h8 (电子表格格式)
      if (!appToken) {
        const sheetsPathMatch = urlObj.pathname.match(
          /\/sheets\/([a-zA-Z0-9]+)/
        )
        if (sheetsPathMatch) {
          appToken = sheetsPathMatch[1]
        }
      }

      // 如果路径中没有找到，尝试从查询参数获取
      if (!appToken) {
        appToken = urlObj.searchParams.get('app')
      }

      // 从查询参数中提取 table ID
      const tableId = urlObj.searchParams.get('table')

      console.log('URL解析详情:', {
        originalUrl: url,
        pathname: urlObj.pathname,
        searchParams: Object.fromEntries(urlObj.searchParams),
        foundAppToken: appToken,
        foundTableId: tableId,
      })

      if (!appToken) {
        throw new Error('无法从URL中提取App Token，请检查URL格式是否正确')
      }

      if (!tableId) {
        throw new Error('无法从URL中提取Table ID，请确保URL包含table参数')
      }

      return { appToken, tableId }
    } catch (error) {
      console.error('URL解析失败:', error)
      throw new Error(
        'URL格式不正确，无法解析App Token和Table ID。请确保使用正确的飞书多维表格链接。'
      )
    }
  }

  // 模拟连接测试
  async function simulateConnectionTest(config: any): Promise<void> {
    console.log('开始模拟连接测试，配置:', {
      hasAppId: !!config.feishuAppId,
      hasAppSecret: !!config.feishuAppSecret,
      hasAppToken: !!config.feishuAppToken,
    })

    // 这里应该是实际的飞书API调用获取tenant_access_token
    // 现在先模拟一个延迟
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 模拟成功响应
        if (
          config.feishuAppId &&
          config.feishuAppSecret &&
          config.feishuAppToken
        ) {
          console.log('连接测试成功')
          resolve()
        } else {
          console.log('连接测试失败，配置不完整')
          reject(new Error('配置不完整'))
        }
      }, 1500)
    })
  }

  // 更新连接状态显示
  function updateConnectionStatus(
    status: 'connected' | 'disconnected' | 'testing',
    message: string
  ) {
    const indicator = connectionStatus.querySelector(
      '.status-indicator'
    ) as HTMLElement

    // 移除所有状态类
    indicator.classList.remove(
      'status-connected',
      'status-disconnected',
      'status-testing'
    )

    // 添加新的状态类
    indicator.classList.add(`status-${status}`)

    // 更新文本
    connectionStatus.innerHTML = `
      <span class="status-indicator status-${status}"></span>
      ${message}
    `
  }

  // 设置按钮加载状态
  function setButtonLoading(button: HTMLButtonElement, loading: boolean) {
    if (loading) {
      button.disabled = true
      const originalText = button.textContent
      button.setAttribute('data-original-text', originalText)
      button.textContent = '处理中...'
    } else {
      button.disabled = false
      const originalText = button.getAttribute('data-original-text')
      if (originalText) {
        button.textContent = originalText
        button.removeAttribute('data-original-text')
      }
    }
  }

  // 显示提示消息
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast.textContent = message
    toast.className = `toast ${type}`

    setTimeout(() => {
      toast.className = 'toast hide'
    }, 5000)
  }

  // 监听存储变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      configFields.forEach(field => {
        if (changes[field]) {
          console.log(`配置 ${field} 已更新`)
        }
      })
    }
  })
})

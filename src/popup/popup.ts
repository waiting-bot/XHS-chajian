// DOM 元素
const collectBtn = document.getElementById('collectBtn') as HTMLButtonElement
const configBtn = document.getElementById('configBtn') as HTMLButtonElement
const status = document.getElementById('status') as HTMLDivElement

// 检查当前标签页是否为小红书笔记页面
async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!tab.url?.includes('xiaohongshu.com/explore/')) {
      updateStatus('请先打开小红书笔记页面', false)
      collectBtn.disabled = true
      return
    }
    
    updateStatus('检测到小红书笔记页面', true)
    collectBtn.disabled = false
  } catch (error) {
    console.error('检查页面失败:', error)
    updateStatus('检查页面失败', false)
  }
}

// 更新状态显示
function updateStatus(message: string, isSuccess: boolean = false) {
  const statusEl = status.querySelector('p')
  if (statusEl) {
    statusEl.textContent = message
    statusEl.style.color = isSuccess ? '#28a745' : '#666'
  }
}

// 采集笔记数据
async function collectNote() {
  try {
    collectBtn.disabled = true
    updateStatus('正在采集笔记数据...')
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!tab.id) {
      throw new Error('无法获取当前标签页')
    }
    
    // 向内容脚本发送采集指令
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 这里会调用内容脚本中的采集函数
        return { success: true, data: null }
      }
    })
    
    if (results[0].result?.success) {
      updateStatus('笔记数据采集成功！', true)
    } else {
      updateStatus('采集失败，请重试', false)
    }
  } catch (error) {
    console.error('采集失败:', error)
    updateStatus('采集失败: ' + (error as Error).message, false)
  } finally {
    collectBtn.disabled = false
  }
}

// 打开配置页面
function openConfig() {
  chrome.runtime.openOptionsPage()
}

// 事件监听
collectBtn?.addEventListener('click', collectNote)
configBtn?.addEventListener('click', openConfig)

// 初始化
document.addEventListener('DOMContentLoaded', checkCurrentPage)
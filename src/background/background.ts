chrome.runtime.onInstalled.addListener(() => {
  console.log('小红书笔记采集器已安装')
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COLLECT_NOTE_DATA') {
    // 处理笔记数据采集
    sendResponse({ success: true })
  }
  
  return true
})
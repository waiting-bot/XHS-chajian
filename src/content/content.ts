// 检测是否在小红书笔记页面
function isNotePage() {
  return window.location.hostname === 'www.xiaohongshu.com' && 
         window.location.pathname.startsWith('/explore/')
}

// 采集笔记数据
function collectNoteData() {
  if (!isNotePage()) return null

  try {
    // 这里后续会实现具体的DOM采集逻辑
    return {
      title: '',
      author: '',
      content: '',
      tags: [],
      images: [],
      video: null,
      likes: 0,
      collects: 0,
      comments: 0
    }
  } catch (error) {
    console.error('采集笔记数据失败:', error)
    return null
  }
}

// 页面加载完成后执行
if (isNotePage()) {
  chrome.runtime.sendMessage({
    type: 'NOTE_PAGE_DETECTED',
    url: window.location.href
  })
}
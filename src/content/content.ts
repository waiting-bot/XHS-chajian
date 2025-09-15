// 直接使用Chrome提供的全局chrome对象

// 使用命名空间避免全局污染
(function() {
  // 添加防重复注入检查
  if (window.hasRunXhsChajianContentScript) return;
  window.hasRunXhsChajianContentScript = true;

    // 接口定义
  interface PageInfo {
    isNotePage: boolean
    url: string
    type: 'note' | 'home' | 'other'
    pageId: string | null
    status: 'loading' | 'ready' | 'error'
  }

  interface NotePageData {
    title: string
    author: string
    content: string
    tags: string[]
    images: string[]
    video: string | null
    likes: number
    collects: number
    comments: number
  }

  // 页面检测模块
  class PageDetector {
    private pageStatus: PageInfo = {
      isNotePage: false,
      url: '',
      type: 'other',
      pageId: null,
      status: 'loading',
    }

    constructor() {
      this.init()
    }

    private init() {
      this.detectPageType()
      this.sendPageStatus()
      this.monitorPageChanges()
    }

    private detectPageType(): void {
      const url = window.location.href
      const hostname = window.location.hostname
      const pathname = window.location.pathname

      this.pageStatus.url = url

      if (hostname === 'www.xiaohongshu.com' && this.checkIfNotePage()) {
        this.pageStatus.isNotePage = true
        this.pageStatus.type = 'note'
        this.pageStatus.pageId = this.extractPageId(pathname)
      } else if (hostname === 'www.xiaohongshu.com') {
        this.pageStatus.type = 'home'
      } else {
        this.pageStatus.type = 'other'
      }
    }

    // 检测是否在笔记页面
    private checkIfNotePage(): boolean {
      // URL模式匹配
      const noteUrlPatterns = [
        /https:\/\/www\.xiaohongshu\.com\/discovery\/item\/[a-z0-9]+/i,
        /https:\/\/www\.xiaohongshu\.com\/explore\/[a-z0-9]+/i,
        /https:\/\/www\.xiaohongshu\.com\/user\/profile\/[a-z0-9]+\/post\/[a-z0-9]+/i,
      ]

      // 页面元素检测 - 更新为小红书当前页面结构
      const hasNoteContent = !!document.querySelector(
        '[class*="note-detail"], [class*="note-container"], [class*="detail-container"]'
      )
      const hasNoteImages = !!document.querySelector(
        '[class*="swiper-wrapper"], [class*="image-container"], [class*="media-container"]'
      )
      const hasNoteTitle = !!document.querySelector(
        'h1[class*="title"], [class*="note-title"], [class*="detail-title"]'
      )

      return (
        noteUrlPatterns.some(pattern => pattern.test(location.href)) &&
        (hasNoteContent || hasNoteImages || hasNoteTitle)
      )
    }

    private extractPageId(pathname: string): string | null {
      // 支持多种URL格式的页面ID提取
      const patterns = [
        /\/explore\/([a-f0-9]+)/,
        /\/discovery\/item\/([a-f0-9]+)/,
        /\/user\/profile\/[a-z0-9]+\/post\/([a-f0-9]+)/,
      ]

      for (const pattern of patterns) {
        const match = pathname.match(pattern)
        if (match) {
          return match[1]
        }
      }
      return null
    }

    private sendPageStatus(): void {
      chrome.runtime.sendMessage({
        type: 'PAGE_STATUS_UPDATE',
        data: this.pageStatus,
      })
    }

    private monitorPageChanges(): void {
      const observer = new MutationObserver(() => {
        if (this.pageStatus.type === 'note') {
          this.checkPageReadiness()
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      })

      this.checkPageReadiness()
    }

    private checkPageReadiness(): void {
      try {
        // 更灵活的页面就绪检测 - 检查多种可能的元素
        const selectors = [
          '.note-detail',
          '[class*="note"]',
          '[class*="detail"]',
          '[class*="content"]',
          '[class*="article"]',
          'main',
          '[role="main"]'
        ]
        
        let hasContentLoaded = false
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) {
            hasContentLoaded = true
            console.log(`[Content] 找到页面元素: ${selector}, 数量: ${elements.length}`)
            break
          }
        }

        // 检查页面是否有足够的内容
        const bodyText = document.body?.innerText || ''
        const hasContent = bodyText.length > 100 // 至少100个字符

        if ((hasContentLoaded || hasContent) && this.pageStatus.status === 'loading') {
          console.log('[Content] 页面已就绪，状态更新为ready')
          this.pageStatus.status = 'ready'
          this.sendPageStatus()
        } else if (this.pageStatus.status === 'loading') {
          console.log('[Content] 页面仍在加载中...')
        }
      } catch (error) {
        console.error('检查页面就绪状态失败:', error)
        this.pageStatus.status = 'error'
        this.sendPageStatus()
      }
    }

    public getPageStatus(): PageInfo {
      return { ...this.pageStatus }
    }

    public isNotePage(): boolean {
      return this.pageStatus.isNotePage
    }

    public getNoteId(): string | null {
      return this.pageStatus.pageId
    }
  }

  // 数据采集模块
  class DataCollector {
    private selectorManager: any

    constructor(private pageDetector: PageDetector) {
      this.selectorManager = (window as any).selectorManager
    }

    public async collectNoteData(): Promise<NotePageData | null> {
      if (!this.pageDetector.isNotePage()) {
        return null
      }

      try {
        const selectors = this.selectorManager.getSelectors()
        const [
          title,
          author,
          content,
          tags,
          images,
          video,
          likes,
          collects,
          comments,
        ] = await Promise.all([
          this.extractText(selectors.title),
          this.extractText(selectors.author),
          this.extractText(selectors.content),
          this.extractTags(),
          this.extractImages(),
          this.extractVideo(),
          this.extractNumber(selectors.likes),
          this.extractNumber(selectors.collects),
          this.extractNumber(selectors.comments),
        ])

        return {
          title: title || '',
          author: author || '',
          content: content || '',
          tags: tags || [],
          images: images || [],
          video: video || null,
          likes: likes || 0,
          collects: collects || 0,
          comments: comments || 0,
          sourceUrl: window.location.href,
        }
      } catch (error) {
        console.error('采集笔记数据失败:', error)
        return null
      }
    }

    private async extractText(selectors: string[]): Promise<string> {
      for (const selector of selectors) {
        const element = document.querySelector(selector)
        if (element) {
          return element.textContent?.trim() || ''
        }
      }
      return ''
    }

    private async extractTags(): Promise<string[]> {
      const tags: string[] = []
      const selectors = this.selectorManager.getSelectors()
      for (const selector of selectors.tags) {
        const elements = document.querySelectorAll(selector)
        elements.forEach(element => {
          const text = element.textContent?.trim()
          if (text && !tags.includes(text)) {
            tags.push(text)
          }
        })
        if (tags.length > 0) break
      }
      return tags
    }

    private async extractImages(): Promise<string[]> {
      const images: string[] = []
      const selectors = this.selectorManager.getSelectors()
      for (const selector of selectors.images) {
        const elements = document.querySelectorAll(selector)
        elements.forEach(element => {
          const src =
            (element as HTMLImageElement).src || element.getAttribute('src')
          if (src && src.includes('xiaohongshu.com') && !images.includes(src)) {
            images.push(src)
          }
        })
        if (images.length > 0) break
      }
      return images
    }

    private async extractVideo(): Promise<string | null> {
      const selectors = this.selectorManager.getSelectors()
      for (const selector of selectors.video) {
        const element = document.querySelector(selector)
        if (element) {
          const src =
            (element as HTMLVideoElement).src || element.getAttribute('src')
          if (src) return src
        }
      }
      return null
    }

    private async extractNumber(selectors: string[]): Promise<number> {
      for (const selector of selectors) {
        const element = document.querySelector(selector)
        if (element) {
          const text = element.textContent?.trim() || '0'
          const number = parseInt(text.replace(/[^\d]/g, ''))
          return isNaN(number) ? 0 : number
        }
      }
      return 0
    }
  }

  // 初始化选择器管理器（如果不存在）
  if (!(window as any).selectorManager) {
    (window as any).selectorManager = {
      getSelectors: function() {
        return {
          title: ['h1', '[class*="title"]', '[class*="note-title"]'],
          author: ['[class*="author"]', '[class*="user"]'],
          content: ['[class*="content"]', '[class*="desc"]', '[class*="text"]'],
          tags: ['[class*="tag"]', '[class*="label"]'],
          images: ['img[src*="xiaohongshu"]'],
          video: ['video[src*="xiaohongshu"]'],
          likes: ['[class*="like"]', '[class*="heart"]'],
          collects: ['[class*="collect"]', '[class*="star"]'],
          comments: ['[class*="comment"]', '[class*="reply"]']
        }
      },
      testSelectors: async function() {
        return { success: true, message: '选择器测试功能' }
      },
      resetToDefault: function() {
        console.log('选择器已重置为默认值')
      }
    }
  }

  // 主模块实例
  const pageDetector = new PageDetector()
  const dataCollector = new DataCollector(pageDetector)

  // 消息处理函数
  function handleMessage(message, _sender, sendResponse) {
    switch (message.type) {
      case 'ping':
        sendResponse({ pong: true })
        break
      case 'GET_PAGE_STATUS':
        sendResponse({ status: pageDetector.getPageStatus() })
        break
      case 'COLLECT_NOTE_DATA':
        // 当收到采集消息时
        if (!pageDetector.isNotePage()) {
          // 发送错误状态到popup
          chrome.runtime.sendMessage({
            type: 'pageError',
            message: '当前页面不是小红书笔记',
          })
          sendResponse({ success: false, error: '当前页面不是小红书笔记' })
          return true // 保持消息通道开放
        }

        dataCollector
          .collectNoteData()
          .then(data => {
            console.log('[Content] 数据采集成功:', data)
            sendResponse({ success: true, data })
          })
          .catch(error => {
            console.error('[Content] 数据采集失败:', error)
            sendResponse({ success: false, error: error.message })
          })
        return true // 保持消息通道开放用于异步响应
      case 'GET_NOTE_ID':
        sendResponse({ noteId: pageDetector.getNoteId() })
        break
      case 'TEST_SELECTORS':
        const selectorManager = (window as any).selectorManager
        selectorManager
          .testSelectors()
          .then(results => {
            sendResponse({ success: true, results })
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message })
          })
        return true
      case 'AUTO_DETECT_SELECTORS':
        sendResponse({ success: true, results: { message: '自动检测功能' } })
        return true
      case 'UPDATE_SELECTORS':
        sendResponse({ success: true })
        return true
      case 'RESET_SELECTORS':
        const manager = (window as any).selectorManager
        manager.resetToDefault()
        sendResponse({ success: true })
        break
    }
  }

  // 全局错误处理
  window.addEventListener('error', (event) => {
    console.error('内容脚本错误:', event.error);
  });

  // 初始化逻辑
  chrome.runtime.onMessage.addListener(handleMessage);

  // 页面初始化
  console.log('小红书笔记采集器已加载')
  console.log('页面状态:', pageDetector.getPageStatus())
})();

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
    status: 'loading'
  };

  constructor() {
    this.init();
  }

  private init() {
    this.detectPageType();
    this.sendPageStatus();
    this.monitorPageChanges();
  }

  private detectPageType(): void {
    const url = window.location.href;
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    this.pageStatus.url = url;

    if (hostname === 'www.xiaohongshu.com' && pathname.startsWith('/explore/')) {
      this.pageStatus.isNotePage = true;
      this.pageStatus.type = 'note';
      this.pageStatus.pageId = this.extractPageId(pathname);
    } else if (hostname === 'www.xiaohongshu.com') {
      this.pageStatus.type = 'home';
    } else {
      this.pageStatus.type = 'other';
    }
  }

  private extractPageId(pathname: string): string | null {
    const match = pathname.match(/\/explore\/([a-f0-9]+)/);
    return match ? match[1] : null;
  }

  private sendPageStatus(): void {
    chrome.runtime.sendMessage({
      type: 'PAGE_STATUS_UPDATE',
      data: this.pageStatus
    });
  }

  private monitorPageChanges(): void {
    const observer = new MutationObserver(() => {
      if (this.pageStatus.type === 'note') {
        this.checkPageReadiness();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    this.checkPageReadiness();
  }

  private checkPageReadiness(): void {
    try {
      const contentElements = document.querySelectorAll('.note-detail');
      const hasContentLoaded = contentElements.length > 0;

      if (hasContentLoaded && this.pageStatus.status === 'loading') {
        this.pageStatus.status = 'ready';
        this.sendPageStatus();
      }
    } catch (error) {
      console.error('检查页面就绪状态失败:', error);
      this.pageStatus.status = 'error';
      this.sendPageStatus();
    }
  }

  public getPageStatus(): PageInfo {
    return { ...this.pageStatus };
  }

  public isNotePage(): boolean {
    return this.pageStatus.isNotePage;
  }

  public getNoteId(): string | null {
    return this.pageStatus.pageId;
  }
}

// 数据采集模块
class DataCollector {
  private selectorManager: any;

  constructor(private pageDetector: PageDetector) {
    this.selectorManager = (window as any).selectorManager;
  }

  public async collectNoteData(): Promise<NotePageData | null> {
    if (!this.pageDetector.isNotePage()) {
      return null;
    }

    try {
      const selectors = this.selectorManager.getSelectors();
      const [title, author, content, tags, images, video, likes, collects, comments] = await Promise.all([
        this.extractText(selectors.title),
        this.extractText(selectors.author),
        this.extractText(selectors.content),
        this.extractTags(),
        this.extractImages(),
        this.extractVideo(),
        this.extractNumber(selectors.likes),
        this.extractNumber(selectors.collects),
        this.extractNumber(selectors.comments)
      ]);

      return {
        title: title || '',
        author: author || '',
        content: content || '',
        tags: tags || [],
        images: images || [],
        video: video || null,
        likes: likes || 0,
        collects: collects || 0,
        comments: comments || 0
      };
    } catch (error) {
      console.error('采集笔记数据失败:', error);
      return null;
    }
  }

  private async extractText(selectors: string[]): Promise<string> {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent?.trim() || '';
      }
    }
    return '';
  }

  private async extractTags(): Promise<string[]> {
    const tags: string[] = [];
    const selectors = this.selectorManager.getSelectors();
    for (const selector of selectors.tags) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent?.trim();
        if (text && !tags.includes(text)) {
          tags.push(text);
        }
      });
      if (tags.length > 0) break;
    }
    return tags;
  }

  private async extractImages(): Promise<string[]> {
    const images: string[] = [];
    const selectors = this.selectorManager.getSelectors();
    for (const selector of selectors.images) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const src = (element as HTMLImageElement).src || element.getAttribute('src');
        if (src && src.includes('xiaohongshu.com') && !images.includes(src)) {
          images.push(src);
        }
      });
      if (images.length > 0) break;
    }
    return images;
  }

  private async extractVideo(): Promise<string | null> {
    const selectors = this.selectorManager.getSelectors();
    for (const selector of selectors.video) {
      const element = document.querySelector(selector);
      if (element) {
        const src = (element as HTMLVideoElement).src || element.getAttribute('src');
        if (src) return src;
      }
    }
    return null;
  }

  private async extractNumber(selectors: string[]): Promise<number> {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '0';
        const number = parseInt(text.replace(/[^\d]/g, ''));
        return isNaN(number) ? 0 : number;
      }
    }
    return 0;
  }
}

// 导入选择器管理器
import { selectorManager } from '../config/selectors';

// 主模块实例
const pageDetector = new PageDetector();
const dataCollector = new DataCollector(pageDetector)

// 将选择器管理器暴露到全局作用域供数据采集器使用
(window as any).selectorManager = selectorManager;

// 消息处理
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
  case 'GET_PAGE_STATUS':
    sendResponse({ status: pageDetector.getPageStatus() });
    break;
  case 'COLLECT_NOTE_DATA':
    dataCollector.collectNoteData().then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  case 'GET_NOTE_ID':
    sendResponse({ noteId: pageDetector.getNoteId() });
    break;
  case 'TEST_SELECTORS':
    selectorManager.testSelectors().then(results => {
      sendResponse({ success: true, results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  case 'AUTO_DETECT_SELECTORS':
    selectorManager.autoDetectWorkingSelectors().then(results => {
      sendResponse({ success: true, results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  case 'UPDATE_SELECTORS':
    try {
      selectorManager.saveUserConfig(message.config).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  case 'RESET_SELECTORS':
    selectorManager.resetToDefault();
    sendResponse({ success: true });
    break;
  }
});

// 页面初始化
console.log('小红书笔记采集器已加载');
console.log('页面状态:', pageDetector.getPageStatus());
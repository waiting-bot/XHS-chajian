import { SafeStorage } from '../utils/safeStorage';

export interface SelectorsConfig {
  title: string[]
  author: string[]
  content: string[]
  tags: string[]
  images: string[]
  video: string[]
  likes: string[]
  collects: string[]
  comments: string[]
}

export interface SelectorConfig {
  primary: SelectorsConfig
  fallback: SelectorsConfig
  legacy: SelectorsConfig
}

export const DEFAULT_SELECTORS: SelectorConfig = {
  primary: {
    title: ['h1.note-detail-title', '.note-detail h1', '[data-testid="note-title"]'],
    author: ['.author-name', '.note-author-name', '[data-testid="author-name"]'],
    content: ['.note-detail-desc', '.note-content', '[data-testid="note-content"]'],
    tags: ['.tag-item', '.note-tag', '[data-testid="tag"]'],
    images: ['img[src*="xiaohongshu.com"]', '.note-image img', '[data-testid="note-image"]'],
    video: ['video source', '.note-video video', '[data-testid="note-video"]'],
    likes: ['.like-count', '.interaction-like', '[data-testid="like-count"]'],
    collects: ['.collect-count', '.interaction-collect', '[data-testid="collect-count"]'],
    comments: ['.comment-count', '.interaction-comment', '[data-testid="comment-count"]']
  },
  fallback: {
    title: ['h1', '.title', '[class*="title"]'],
    author: ['[class*="author"]', '.creator', '[class*="user"]'],
    content: ['[class*="desc"]', '.content', '[class*="content"]'],
    tags: ['[class*="tag"]', '.hashtags', '.labels'],
    images: ['img', '.image img', '[class*="image"] img'],
    video: ['video', 'source[type="video/mp4"]'],
    likes: ['[class*="like"]', '[data-likes]', '.heart'],
    collects: ['[class*="collect"]', '[data-collects]', '.star'],
    comments: ['[class*="comment"]', '[data-comments]', '.chat']
  },
  legacy: {
    title: ['.note-title', '.post-title', 'h2'],
    author: ['.user-name', '.creator-name'],
    content: ['.note-text', '.post-content'],
    tags: ['.hashtag', '.tag'],
    images: ['img[class*="photo"]', 'img[class*="image"]'],
    video: ['video', 'source'],
    likes: ['.likes', '.heart-count'],
    collects: ['.collects', '.favorite-count'],
    comments: ['.comments', '.reply-count']
  }
};

export class SelectorManager {
  private currentConfig: SelectorConfig = DEFAULT_SELECTORS;
  private activeLevel: 'primary' | 'fallback' | 'legacy' = 'primary';

  constructor() {
    this.loadUserConfig();
  }

  private async loadUserConfig(): Promise<void> {
    try {
      const result = await SafeStorage.get(['selectorsConfig']);
      if (result.selectorsConfig) {
        this.currentConfig = { ...DEFAULT_SELECTORS, ...result.selectorsConfig };
      }
    } catch (error) {
      console.warn('加载用户选择器配置失败:', error);
    }
  }

  public async saveUserConfig(config: Partial<SelectorConfig>): Promise<void> {
    try {
      const mergedConfig = { ...this.currentConfig, ...config };
      await SafeStorage.set({ selectorsConfig: mergedConfig });
      this.currentConfig = mergedConfig;
    } catch (error) {
      console.error('保存用户选择器配置失败:', error);
      throw error;
    }
  }

  public getSelectors(level: 'primary' | 'fallback' | 'legacy' = this.activeLevel): SelectorsConfig {
    return this.currentConfig[level];
  }

  public getAllSelectors(): SelectorConfig {
    return this.currentConfig;
  }

  public setActiveLevel(level: 'primary' | 'fallback' | 'legacy'): void {
    this.activeLevel = level;
  }

  public getActiveLevel(): 'primary' | 'fallback' | 'legacy' {
    return this.activeLevel;
  }

  public async testSelectors(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const selectors = this.getSelectors();

    for (const [field, selectorList] of Object.entries(selectors)) {
      results[field] = false;
      for (const selector of selectorList) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[field] = true;
          break;
        }
      }
    }

    return results;
  }

  public async testSelector(selector: string): Promise<boolean> {
    try {
      const elements = document.querySelectorAll(selector);
      return elements.length > 0;
    } catch (error) {
      console.error(`测试选择器失败 ${selector}:`, error);
      return false;
    }
  }

  public async autoDetectWorkingSelectors(): Promise<SelectorsConfig> {
    const detectedSelectors: SelectorsConfig = {
      title: [],
      author: [],
      content: [],
      tags: [],
      images: [],
      video: [],
      likes: [],
      collects: [],
      comments: []
    };

    for (const level of ['primary', 'fallback', 'legacy'] as const) {
      const levelSelectors = this.currentConfig[level];
      
      for (const [field, selectorList] of Object.entries(levelSelectors)) {
        for (const selector of selectorList) {
          if (await this.testSelector(selector)) {
            if (!detectedSelectors[field as keyof SelectorsConfig].includes(selector)) {
              detectedSelectors[field as keyof SelectorsConfig].push(selector);
            }
            break;
          }
        }
      }
    }

    return detectedSelectors;
  }

  public updateSelector(field: keyof SelectorsConfig, level: 'primary' | 'fallback' | 'legacy', selectors: string[]): void {
    this.currentConfig[level][field] = selectors;
  }

  public addSelector(field: keyof SelectorsConfig, level: 'primary' | 'fallback' | 'legacy', selector: string): void {
    if (!this.currentConfig[level][field].includes(selector)) {
      this.currentConfig[level][field].push(selector);
    }
  }

  public removeSelector(field: keyof SelectorsConfig, level: 'primary' | 'fallback' | 'legacy', selector: string): void {
    this.currentConfig[level][field] = this.currentConfig[level][field].filter(s => s !== selector);
  }

  public resetToDefault(): void {
    this.currentConfig = { ...DEFAULT_SELECTORS };
    this.activeLevel = 'primary';
  }

  public exportConfig(): string {
    return JSON.stringify(this.currentConfig, null, 2);
  }

  public importConfig(configJson: string): boolean {
    try {
      const importedConfig = JSON.parse(configJson);
      this.currentConfig = { ...DEFAULT_SELECTORS, ...importedConfig };
      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      return false;
    }
  }
}

export const selectorManager = new SelectorManager();

export default DEFAULT_SELECTORS;
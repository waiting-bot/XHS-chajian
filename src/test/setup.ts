// 全局测试环境设置
import { vi } from 'vitest'

// 创建 Chrome API 模拟
const createChromeMock = () => {
  const mockStorage = {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn()
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }

  const mockRuntime = {
    id: 'test-extension-id',
    getURL: vi.fn(),
    getManifest: vi.fn(),
    connect: vi.fn(),
    sendMessage: vi.fn()
  }

  return {
    storage: mockStorage,
    runtime: mockRuntime,
    tabs: {
      query: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn()
    },
    scripting: {
      executeScript: vi.fn(),
      insertCSS: vi.fn()
    },
    action: {
      onClicked: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    }
  }
}

// 模拟 Chrome API
global.chrome = createChromeMock()

// 添加 jest 全局变量以兼容 jest-chrome
global.jest = {
  fn: vi.fn,
  clearAllMocks: vi.clearAllMocks,
  mock: vi.mock,
  spyOn: vi.spyOn
}

// 模拟 console 方法以避免测试中的过多输出
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

// 设置测试环境变量
process.env.NODE_ENV = 'test'

// 清理函数
afterEach(() => {
  vi.clearAllMocks()
})

// 全局超时设置
vi.setConfig({
  testTimeout: 10000,
  hookTimeout: 10000,
})
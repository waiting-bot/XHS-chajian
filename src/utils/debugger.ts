export function enableDebugMode() {
  // 在URL中添加debug参数启用调试
  if (new URLSearchParams(window.location.search).has('debug')) {
    console.debug('调试模式已启用');
    
    // 暴露内部状态到全局
    (window as any).debug = {
      reloadContentScript: () => {
        chrome.tabs.query({active: true}, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      },
      testFeishu: async () => {
        // 测试飞书连接
        console.log('测试飞书连接...');
      },
      getState: () => {
        // 导入状态管理
        import('./state-manager.js').then(module => {
          return module.CollectionState.currentState;
        });
      }
    };
  }
}
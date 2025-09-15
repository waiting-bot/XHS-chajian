{
  "task": "修复小红书笔记采集器",
  "description": "修复小红书笔记采集器无法采集的问题，包括 URL 匹配失效、DOM 选择器失效、异步消息链返回 undefined 等问题。",
  "files": [
    {
      "path": "manifest.json",
      "action": "update",
      "changes": [
        {
          "field": "content_scripts[0].matches",
          "value": [
            "https://www.xiaohongshu.com/user/profile/*?note=*",
            "https://www.xiaohongshu.com/explore/*",
            "https://www.xiaohongshu.com/*note/*"
          ]
        }
      ]
    },
    {
      "path": "content/content.js",
      "action": "update",
      "instructions": [
        "检查 DOM 选择器 '[class*=\"note\"]' 是否能抓取完整 note 内容，必要时增加延迟等待动态加载。",
        "删除测试数据调用，只发送真实抓取的数据。",
        "使用 chrome.runtime.sendMessage({ type: 'UPLOAD_NOTE', data: noteData }) 发送数据。",
        "增加日志 console.log('[Content] 数据采集成功:', noteData)。"
      ]
    },
    {
      "path": "background.ts",
      "action": "update",
      "instructions": [
        "确保 chrome.runtime.onMessage.addListener 正确处理 UPLOAD_NOTE 消息。",
        "uploadToFeishu 返回值：成功写入返回 record_id，失败返回 error 信息。",
        "删除所有测试数据调用。",
        "异步函数中正确使用 await，并在 sendResponse 中返回结果，如：\nchrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {\n  if(message.type === 'UPLOAD_NOTE' && message.data) {\n    try {\n      const result = await uploadToFeishu(message.data);\n      sendResponse({ success: true, recordId: result[0]?.recordIds?.[0] });\n    } catch (err) {\n      sendResponse({ success: false, error: err.message });\n    }\n    return true;\n  }\n});",
        "保留原有 FeishuAPIClient、urlToFile、processFileUploads、buildTableRecord 等逻辑。"
      ]
    }
  ],
  "testing": {
    "steps": [
      "点击扩展图标，在用户主页和 explore 页面分别采集笔记。",
      "Chrome 控制台输出：[Content] 数据采集成功 和 [Background] 飞书写入成功, record_id。",
      "飞书多维表格新增数据正确，不再出现测试标题或调试测试数据。"
    ]
  },
  "goal": "扩展可以在所有笔记页面成功采集数据并写入多维表格，异步消息链正确返回，UI 显示采集状态为 '采集成功'，日志链路完整。"
}

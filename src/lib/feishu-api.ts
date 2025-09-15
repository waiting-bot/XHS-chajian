export async function writeToFeishuTable(data: any, config: any) {
  // 使用正确的字段名
  const appToken = config.feishuAppToken;
  const accessToken = config.feishuPersonalBaseToken;
  const tableId = config.feishuTableId;
  
  if (!appToken || !accessToken || !tableId) {
    throw new Error('飞书配置不完整');
  }

  try {
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            title: data.title,
            author: data.author,
            content: data.content,
            // 其他字段...
          }
        })
      }
    );

    const result = await response.json();
    
    // 完整的错误处理
    if (result.code !== 0) {
      throw new Error(`飞书API错误: ${result.msg} (code: ${result.code})`);
    }
    
    return result.data;
  } catch (error) {
    console.error('飞书写入失败:', error);
    throw error;
  }
}
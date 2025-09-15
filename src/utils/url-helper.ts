export function validateFeishuUrl(url) {
  const validEndpoints = [
    '/open-apis/auth/v3/tenant_access_token/internal',
    '/open-apis/authen/v1/user_info',
    '/open-apis/bitable/v1/apps'
  ];
  
  const isValid = validEndpoints.some(endpoint => url.includes(endpoint));
  
  if (!isValid) {
    console.warn('可疑的飞书API URL:', url);
    throw new Error(`无效的API端点: ${url}`);
  }
  
  return true;
}
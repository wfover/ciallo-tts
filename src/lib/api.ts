// 共享的 API 响应工具：CORS 头、JSON 响应、OPTIONS 预检。
// 全部使用 Web 标准 API，保证 Vercel / Docker / Cloudflare 三种部署目标通用。

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-auth-token",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...init.headers },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, { status });
}

/** OPTIONS 预检统一处理 */
export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

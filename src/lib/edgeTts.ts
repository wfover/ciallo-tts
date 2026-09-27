// Edge TTS 服务端核心逻辑（自 api/tts.js 移植）。
// 仅使用 Web 标准 API（fetch / crypto.subtle / atob / btoa），
// 兼容 Node 18+、Vercel、Cloudflare Workers。

let expiredAt: number | null = null;
let endpoint: { t: string; r: string } | null = null;
let refreshPromise: Promise<void> | null = null;
let clientId = "76a75279-2ffa-4c3d-8db8-7b47252aa41c";

/** 音频格式 → 文件扩展名 */
export function formatToExtension(format: string): string {
  const f = format.toLowerCase();
  if (f.includes("mp3")) return "mp3";
  // 容器格式需在编码格式之前判断：如 ogg-24khz-16bit-mono-opus 应返回 .ogg
  if (f.includes("ogg")) return "ogg";
  if (f.includes("webm")) return "webm";
  if (f.includes("opus")) return "opus";
  if (f.includes("flac")) return "flac";
  if (f.includes("wav") || f.includes("riff")) return "wav";
  if (f.includes("truesilk")) return "silk";
  if (f.includes("amr-wb")) return "amr";
  if (f.includes("webm")) return "webm";
  if (f.includes("pcm") || f.includes("raw")) return "pcm";
  return "mp3";
}

export function escapeXml(str: unknown): string {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string
  ));
}

export function generateSsml(text: string, voiceName: string, rate: number, pitch: number): string {
  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">
              <voice name="${escapeXml(voiceName)}">
                  <mstts:express-as style="general" styledegree="1.0" role="default">
                      <prosody rate="${rate}%" pitch="${pitch}%" volume="50">${escapeXml(text)}</prosody>
                  </mstts:express-as>
              </voice>
          </speak>`;
}

/** token 过期前 60 秒刷新；并发请求共享同一次刷新（单飞） */
async function refreshEndpoint(): Promise<void> {
  if (!expiredAt || Date.now() / 1000 > expiredAt - 60) {
    if (!refreshPromise) {
      refreshPromise = doRefreshEndpoint().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
  }
}

async function doRefreshEndpoint(): Promise<void> {
  endpoint = await getEndpoint();

  // 解析 JWT 获取过期时间
  const parts = endpoint.t.split(".");
  if (parts.length >= 2) {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decodedJwt = JSON.parse(jsonPayload);
    expiredAt = decodedJwt.exp;
  } else {
    expiredAt = Date.now() / 1000 + 3600;
  }

  clientId = crypto.randomUUID().replace(/-/g, "");
  console.log(`获取 Endpoint, 过期时间剩余: ${(((expiredAt ?? 0) - Date.now() / 1000) / 60).toFixed(2)} 分钟`);
}

async function getEndpoint(): Promise<{ t: string; r: string }> {
  const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
  const headers = {
    "Accept-Language": "zh-Hans",
    "X-ClientVersion": "4.0.530a 5fe1dc6c",
    "X-UserId": "0f04d16a175c411e",
    "X-HomeGeographicRegion": "zh-Hans-CN",
    "X-ClientTraceId": clientId || "76a75279-2ffa-4c3d-8db8-7b47252aa41c",
    "X-MT-Signature": await generateSignature(endpointUrl),
    "User-Agent": "okhttp/4.5.0",
    "Content-Type": "application/json; charset=utf-8",
    "Accept-Encoding": "gzip",
  };

  const response = await fetch(endpointUrl, { method: "POST", headers });
  if (!response.ok) {
    throw new Error(`获取 Endpoint 失败，状态码 ${response.status}`);
  }
  return await response.json();
}

async function generateSignature(urlStr: string): Promise<string> {
  const url = urlStr.split("://")[1];
  const encodedUrl = encodeURIComponent(url);
  const uuidStr = crypto.randomUUID().replace(/-/g, "");
  const formattedDate = formatDate();
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();

  const keyData = base64ToArrayBuffer(
    "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw=="
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bytesToSign));
  const signatureBase64 = arrayBufferToBase64(signature);

  return `MSTranslatorAndroidApp::${signatureBase64}::${formattedDate}::${uuidStr}`;
}

function formatDate(): string {
  const utcString = new Date().toUTCString().replace(/GMT/, "").trim() + " GMT";
  return utcString.toLowerCase();
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** 生成语音，返回音频 ArrayBuffer */
export async function synthesize(
  text: string,
  voiceName: string,
  rate: number,
  pitch: number,
  outputFormat: string
): Promise<ArrayBuffer> {
  await refreshEndpoint();

  const ssml = generateSsml(text, voiceName, rate, pitch);
  const url = `https://${endpoint!.r}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": endpoint!.t,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": outputFormat,
      "User-Agent": "okhttp/4.5.0",
      "Origin": "https://azure.microsoft.com",
      "Referer": "https://azure.microsoft.com/",
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`TTS 请求失败，状态码 ${response.status}`);
  }
  return await response.arrayBuffer();
}

// 客户端 TTS 请求构造（自 script.js makeRequest 移植）
// 支持两种协议：openai 格式（/v1/audio/speech 请求体）与 edge 格式（/api/tts 请求体）
import { escapeXml, getTextLength } from "./segmentation";

export interface ApiContext {
  id: string;
  endpoint: string;
  format: "openai" | "edge";
  isCustom: boolean;
  apiKey?: string;
  maxLength?: number | null;
}

export interface TtsRequestOptions {
  voice: string;
  text: string;
  rate: number;
  pitch: number;
  preview: boolean;
  instructions: string;
  audioFormat: string;
}

function escapeXmlProtectSsml(text: string): string {
  // 临时替换 SSML 标签，转义其他特殊字符后还原
  const ssmlTags: string[] = [];
  let tempText = text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, (match) => {
    ssmlTags.push(match);
    return `__SSML_TAG_${ssmlTags.length - 1}__`;
  });

  tempText = tempText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return tempText.replace(/__SSML_TAG_(\d+)__/g, (_, index: string) => ssmlTags[parseInt(index)]);
}

export async function makeTtsRequest(ctx: ApiContext, opts: TtsRequestOptions): Promise<Blob> {
  const text = opts.text;
  const headers: Record<string, string> = {
    Accept: "audio/mpeg",
    "Content-Type": "application/json",
  };

  let requestBody: Record<string, unknown>;

  if (ctx.format === "openai") {
    // OpenAI 格式不支持停顿标签，移除之
    const cleanText = text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, "");
    const textLength = getTextLength(cleanText);
    const maxTotalLength = ctx.maxLength ? ctx.maxLength * 5 : 5000;
    if (textLength > maxTotalLength) {
      throw new Error(`OpenAI格式API文本总长度超限，最多支持${maxTotalLength}个单位，当前长度: ${textLength}`);
    }

    requestBody = {
      model: opts.voice,
      input: cleanText,
      voice: ctx.isCustom ? "alloy" : opts.voice,
      response_format: opts.audioFormat,
    };
    if (opts.instructions) {
      requestBody.instructions = opts.instructions;
    }
    if (ctx.isCustom && ctx.apiKey) {
      headers["Authorization"] = `Bearer ${ctx.apiKey}`;
    }
  } else {
    // Edge 格式。内置 API 由服务端统一做 SSML 转义，客户端只保护停顿标签；
    // 自定义 Edge API 保持旧行为：客户端先转义（保护停顿标签）
    const payloadText = ctx.isCustom ? escapeXmlProtectSsml(text) : text;
    requestBody = {
      text: payloadText,
      voice: opts.voice,
      rate: Math.round(opts.rate),
      pitch: Math.round(opts.pitch),
      preview: opts.preview,
    };

    if (ctx.isCustom && ctx.apiKey) {
      if (ctx.apiKey.toLowerCase().startsWith("x-api-key:")) {
        headers["x-api-key"] = ctx.apiKey.substring("x-api-key:".length).trim();
      } else {
        headers["Authorization"] = `Bearer ${ctx.apiKey}`;
      }
    }
  }

  const response = await fetch(ctx.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`服务器响应错误: ${response.status} - ${errorText || response.statusText}`);
  }

  const blob = await response.blob();
  if (!blob.type.includes("audio/") || blob.size === 0) {
    throw new Error("无效的音频文件");
  }
  return blob;
}

/** 下载用的音频扩展名 */
export function audioExtension(ctx: ApiContext, audioFormat: string): string {
  return ctx.format === "openai" ? audioFormat : "mp3";
}

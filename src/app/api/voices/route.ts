import { errorResponse, jsonResponse, preflightResponse, CORS_HEADERS } from "@/lib/api";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface VoiceItem {
  ShortName: string;
  LocalName: string;
  Locale: string;
  Gender: string;
  WordsPerMinute?: number;
  SampleRateHertz?: number;
  [key: string]: unknown;
}

export async function OPTIONS() {
  return preflightResponse();
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const localeFilter = (q.get("l") || "").toLowerCase();
    const format = q.get("f");

    let voices = await voiceList();
    if (localeFilter) {
      voices = voices.filter((item) => item.Locale.toLowerCase().includes(localeFilter));
    }

    if (format === "0") {
      // MultiTTS YAML speaker 格式
      const formatted = voices.map(formatVoiceItem);
      return new Response(formatted.join("\n"), {
        headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
      });
    } else if (format === "1") {
      return jsonResponse(Object.fromEntries(voices.map((item) => [item.ShortName, item.LocalName])));
    } else {
      return jsonResponse(voices);
    }
  } catch (error) {
    console.error("API Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch voices");
  }
}

function formatVoiceItem(item: VoiceItem): string {
  return `
- !!org.nobody.multitts.tts.speaker.Speaker
  avatar: ''
  code: ${item.ShortName}
  desc: ''
  extendUI: ''
  gender: ${item.Gender === "Female" ? "0" : "1"}
  name: ${item.LocalName}
  note: 'wpm: ${item.WordsPerMinute || ""}'
  param: ''
  sampleRate: ${item.SampleRateHertz || "24000"}
  speed: 1.5
  type: 1
  volume: 1`;
}

// 语音列表缓存：避免每次请求都向上游拉取全量列表
const VOICES_CACHE_TTL = 60 * 60 * 1000; // 1 小时
let voicesCache: VoiceItem[] | null = null;
let voicesCacheTime = 0;
let voicesCachePromise: Promise<VoiceItem[]> | null = null;

async function voiceList(): Promise<VoiceItem[]> {
  const now = Date.now();
  if (voicesCache && now - voicesCacheTime < VOICES_CACHE_TTL) {
    return voicesCache;
  }
  // 并发去重：同一时刻只发一次上游请求
  if (!voicesCachePromise) {
    voicesCachePromise = (async () => {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "X-Ms-Useragent": "SpeechStudio/2021.05.001",
        "Content-Type": "application/json",
        "Origin": "https://azure.microsoft.com",
        "Referer": "https://azure.microsoft.com",
      };

      const response = await fetch("https://eastus.api.speech.microsoft.com/cognitiveservices/voices/list", {
        headers,
      });

      if (!response.ok) {
        throw new Error(`获取语音列表失败，状态码 ${response.status}`);
      }

      const data = (await response.json()) as VoiceItem[];
      voicesCache = data;
      voicesCacheTime = Date.now();
      return data;
    })().finally(() => {
      voicesCachePromise = null;
    });
  }
  return voicesCachePromise;
}

import { errorResponse, preflightResponse, CORS_HEADERS } from "@/lib/api";
import { synthesize, formatToExtension, normalizeOutputFormat, type SsmlOptions } from "@/lib/edgeTts";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_VOICE = "zh-CN-XiaoxiaoMultilingualNeural";

function parseVolume(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : undefined;
}

export async function OPTIONS() {
  return preflightResponse();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ssml: SsmlOptions = {
      style: body.style ? String(body.style) : undefined,
      role: body.role ? String(body.role) : undefined,
      volume: parseVolume(body.volume),
    };
    return handleTTS(
      String(body.text ?? ""),
      String(body.voice || DEFAULT_VOICE),
      Number(body.rate) || 0,
      Number(body.pitch) || 0,
      String(body.format || ""),
      body.preview === false,
      ssml
    );
  } catch (error) {
    console.error("API Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal Server Error");
  }
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const ssml: SsmlOptions = {
      style: q.get("style") || undefined,
      role: q.get("role") || undefined,
      volume: parseVolume(q.get("vol")),
    };
    return handleTTS(
      q.get("t") ?? "",
      q.get("v") || DEFAULT_VOICE,
      Number(q.get("r")) || 0,
      Number(q.get("p")) || 0,
      q.get("o") || "",
      q.get("d") === "true",
      ssml
    );
  } catch (error) {
    console.error("API Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal Server Error");
  }
}

async function handleTTS(
  text: string,
  voiceName: string,
  rate: number,
  pitch: number,
  outputFormat: string,
  download: boolean,
  ssml: SsmlOptions
): Promise<Response> {
  if (!text.trim()) {
    return errorResponse("文本不能为空", 400);
  }
  try {
    // 兼容 UI 简写（mp3/opus/wav/pcm）与完整 Microsoft 格式
    const normalizedFormat = normalizeOutputFormat(outputFormat);
    const audio = await synthesize(text, voiceName, rate, pitch, normalizedFormat, ssml);

    const headers: Record<string, string> = {
      ...CORS_HEADERS,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    };
    if (download) {
      // 按实际音频格式给出下载文件扩展名
      headers["Content-Disposition"] =
        `attachment; filename="${encodeURIComponent(voiceName)}.${formatToExtension(normalizedFormat)}"`;
    }
    return new Response(audio, { headers });
  } catch (error) {
    console.error("TTS Error:", error);
    return errorResponse(error instanceof Error ? error.message : "TTS 请求失败");
  }
}

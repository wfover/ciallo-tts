import { errorResponse, preflightResponse, CORS_HEADERS } from "@/lib/api";
import { synthesize, formatToExtension } from "@/lib/edgeTts";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_VOICE = "zh-CN-XiaoxiaoMultilingualNeural";
const DEFAULT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

export async function OPTIONS() {
  return preflightResponse();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return handleTTS(
      String(body.text ?? ""),
      String(body.voice || DEFAULT_VOICE),
      Number(body.rate) || 0,
      Number(body.pitch) || 0,
      String(body.format || DEFAULT_FORMAT),
      body.preview === false
    );
  } catch (error) {
    console.error("API Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal Server Error");
  }
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    return handleTTS(
      q.get("t") ?? "",
      q.get("v") || DEFAULT_VOICE,
      Number(q.get("r")) || 0,
      Number(q.get("p")) || 0,
      q.get("o") || DEFAULT_FORMAT,
      q.get("d") === "true"
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
  download: boolean
): Promise<Response> {
  try {
    const audio = await synthesize(text, voiceName, rate, pitch, outputFormat);

    const headers: Record<string, string> = {
      ...CORS_HEADERS,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    };
    if (download) {
      // 按实际音频格式给出下载文件扩展名
      headers["Content-Disposition"] =
        `attachment; filename="${encodeURIComponent(voiceName)}.${formatToExtension(outputFormat)}"`;
    }
    return new Response(audio, { headers });
  } catch (error) {
    console.error("TTS Error:", error);
    return errorResponse(error instanceof Error ? error.message : "TTS 请求失败");
  }
}

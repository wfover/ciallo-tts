import { errorResponse, jsonResponse, preflightResponse } from "@/lib/api";
import { findEdgeVoice } from "@/lib/edgeVoices";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** 查询某语音可用的情绪风格(style)与角色(role)，供前端渲染下拉选项 */
export async function OPTIONS() {
  return preflightResponse();
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const voice = (q.get("voice") || q.get("v") || "").trim();
  if (!voice) {
    return errorResponse("缺少 voice 参数", 400);
  }

  try {
    const item = await findEdgeVoice(voice);
    if (!item) {
      // 未知语音（如自定义 API 的讲述人）交由前端回退为手动输入
      return jsonResponse({ voice, found: false, styles: [], roles: [] });
    }
    return jsonResponse({
      voice: item.ShortName,
      found: true,
      styles: item.StyleList ?? [],
      roles: item.RolePlayList ?? [],
    });
  } catch (error) {
    console.error("API Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch voice meta");
  }
}

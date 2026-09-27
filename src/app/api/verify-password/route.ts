import { errorResponse, jsonResponse, preflightResponse } from "@/lib/api";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflightResponse();
}

export async function POST(req: NextRequest) {
  // 密码未设置时不需要验证
  if (!process.env.PASSWORD) {
    return jsonResponse({ valid: true, message: "No password required" });
  }

  let password: unknown;
  try {
    const body = await req.json();
    password = body.password;
  } catch {
    return errorResponse("Bad request", 400);
  }

  if (password === process.env.PASSWORD) {
    return jsonResponse({ valid: true });
  }
  return jsonResponse({ valid: false, message: "密码错误" }, { status: 401 });
}

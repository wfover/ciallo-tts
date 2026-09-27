import { jsonResponse, preflightResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflightResponse();
}

export async function GET() {
  return jsonResponse({ requirePassword: !!process.env.PASSWORD });
}

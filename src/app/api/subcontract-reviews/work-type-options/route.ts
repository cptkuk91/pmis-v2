import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { listWorkTypeOptions } from "@/lib/work-type-code";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const siteId = String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const data = await listWorkTypeOptions(siteId);
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

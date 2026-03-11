import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { listWorkforceAttendanceOptions } from "@/lib/workforce-attendance";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const siteId = String(searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const data = await listWorkforceAttendanceOptions(siteId);
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

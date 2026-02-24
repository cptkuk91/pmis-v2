import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import WorkforceAttendance from "@/models/WorkforceAttendance";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const date = searchParams.get("date");
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.attendanceDate = { $gte: d, $lt: next };
    }

    const [data, total] = await Promise.all([
      WorkforceAttendance.find(filter).sort({ attendanceDate: -1 }).skip(skip).limit(limit),
      WorkforceAttendance.countDocuments(filter),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const doc = await WorkforceAttendance.create(body);
    await logCreate(String(body.siteId ?? ""), "workforce_daily", String(doc._id), { userId: null, userName: "system" });
    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

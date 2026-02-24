import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import WorkforceAttendance from "@/models/WorkforceAttendance";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const siteId = request.nextUrl.searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newWorkers = await WorkforceAttendance.aggregate([
      { $match: { siteId: { $eq: siteId }, isDeleted: { $ne: true } } },
      { $group: { _id: "$workerName", firstDate: { $min: "$attendanceDate" }, company: { $first: "$company" }, jobType: { $first: "$jobType" } } },
      { $match: { firstDate: { $gte: thirtyDaysAgo } } },
      { $sort: { firstDate: -1 } },
    ]);
    return success(newWorkers);
  } catch (err) {
    return handleApiError(err);
  }
}

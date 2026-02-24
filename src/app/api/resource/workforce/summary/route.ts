import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import WorkforceAttendance from "@/models/WorkforceAttendance";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      return success([]);
    }
    const siteObjectId = new mongoose.Types.ObjectId(siteId);

    const summary = await WorkforceAttendance.aggregate([
      { $match: { siteId: { $eq: siteObjectId }, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { company: "$company", jobType: "$jobType" },
          totalWorkers: { $sum: 1 },
          totalHours: { $sum: "$hoursWorked" },
          totalOvertime: { $sum: "$overtimeHours" },
        },
      },
      { $sort: { "_id.company": 1, "_id.jobType": 1 } },
    ]);

    return success(summary);
  } catch (err) {
    return handleApiError(err);
  }
}

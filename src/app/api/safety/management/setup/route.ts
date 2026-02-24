import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import GovernmentReport from "@/models/GovernmentReport";
import SafetyManagerAssignment from "@/models/SafetyManagerAssignment";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const siteId = request.nextUrl.searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const [reports, assignments] = await Promise.all([
      GovernmentReport.find({ siteId }).sort({ reportDate: -1 }),
      SafetyManagerAssignment.find({ siteId, isActive: true }).sort({ assignedDate: -1 }),
    ]);
    return success({ reports, assignments });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { type, ...data } = body;
    if (type === "report") {
      const doc = await GovernmentReport.create(data);
      await logCreate(data.siteId, "safety_management_setup", String(doc._id), { userId: null, userName: "system" });
      return success(doc);
    } else if (type === "assignment") {
      const doc = await SafetyManagerAssignment.create(data);
      await logCreate(data.siteId, "safety_management_setup", String(doc._id), { userId: null, userName: "system" });
      return success(doc);
    }
    throw VALIDATION_ERROR("type은 report 또는 assignment여야 합니다.");
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import GovernmentReport from "@/models/GovernmentReport";
import SafetyManagerAssignment from "@/models/SafetyManagerAssignment";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import { isGovernmentReportAgency, isGovernmentReportType } from "@/lib/government-report-constants";

function isReportStatus(value: string): value is "pending" | "submitted" | "completed" {
  return value === "pending" || value === "submitted" || value === "completed";
}

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
    const body = (await request.json()) as Record<string, unknown>;
    const { type, ...data } = body;
    const siteId = String(data.siteId ?? "").trim();
    if (type === "report") {
      const reportType = String(data.reportType ?? "").trim();
      const title = String(data.title ?? "").trim();
      const agency = String(data.agency ?? "").trim();
      const status = String(data.status ?? "pending").trim();

      if (!siteId) {
        throw VALIDATION_ERROR("siteId가 필요합니다.");
      }
      if (!isGovernmentReportType(reportType)) {
        throw VALIDATION_ERROR("인허가 신고 유형 값이 올바르지 않습니다.");
      }
      if (!title) {
        throw VALIDATION_ERROR("title은 필수입니다.");
      }
      if (agency && !isGovernmentReportAgency(agency)) {
        throw VALIDATION_ERROR("기관 값이 올바르지 않습니다.");
      }
      if (!isReportStatus(status)) {
        throw VALIDATION_ERROR("status 값이 올바르지 않습니다.");
      }

      const doc = await GovernmentReport.create(data);
      await logCreate(siteId, "safety_management_setup", String(doc._id), { userId: null, userName: "system" });
      return success(doc);
    } else if (type === "assignment") {
      const managerName = String(data.managerName ?? "").trim();
      const assignedDate = new Date(String(data.assignedDate ?? ""));

      if (!siteId) {
        throw VALIDATION_ERROR("siteId가 필요합니다.");
      }
      if (!managerName) {
        throw VALIDATION_ERROR("managerName은 필수입니다.");
      }
      if (Number.isNaN(assignedDate.getTime())) {
        throw VALIDATION_ERROR("assignedDate 형식이 올바르지 않습니다.");
      }

      const doc = await SafetyManagerAssignment.create(data);
      await logCreate(siteId, "safety_management_setup", String(doc._id), { userId: null, userName: "system" });
      return success(doc);
    }
    throw VALIDATION_ERROR("type은 report 또는 assignment여야 합니다.");
  } catch (err) {
    return handleApiError(err);
  }
}

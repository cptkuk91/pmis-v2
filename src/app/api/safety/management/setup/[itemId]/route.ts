import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import GovernmentReport from "@/models/GovernmentReport";
import SafetyManagerAssignment from "@/models/SafetyManagerAssignment";
import SiteMembership from "@/models/SiteMembership";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { isGovernmentReportAgency, isGovernmentReportType } from "@/lib/government-report-constants";

type Params = {
  params: Promise<{ itemId: string }>;
};

function isReportStatus(value: string): value is "pending" | "submitted" | "completed" {
  return value === "pending" || value === "submitted" || value === "completed";
}

function parseRecordType(value: unknown): "report" | "assignment" {
  const recordType = String(value ?? "").trim();
  if (recordType !== "report" && recordType !== "assignment") {
    throw VALIDATION_ERROR("recordType은 report 또는 assignment여야 합니다.");
  }
  return recordType;
}

function parseDate(value: unknown, fieldName: string): Date {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

async function resolveMember(siteId: string, userIdRaw: unknown) {
  const userId = String(userIdRaw ?? "").trim();
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw VALIDATION_ERROR("userId 선택이 필요합니다.");
  }

  const membership = await SiteMembership.findOne({
    siteId: new mongoose.Types.ObjectId(siteId),
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
    isDeleted: false,
  })
    .populate("userId", "name isActive isDeleted")
    .select({ userId: 1 })
    .lean();

  const user =
    membership?.userId && typeof membership.userId === "object"
      ? (membership.userId as { _id?: unknown; name?: string; isActive?: boolean; isDeleted?: boolean })
      : null;

  if (!membership || !user?._id || !user.name || !user.isActive || user.isDeleted) {
    throw VALIDATION_ERROR("선택한 현장 사용자를 찾을 수 없습니다.");
  }

  return {
    userId: String(user._id),
    managerName: String(user.name).trim(),
  };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectDB();

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = String(body.siteId ?? "").trim();
    const recordType = parseRecordType(body.recordType);

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    if (recordType === "report") {
      const reportType = String(body.reportType ?? "").trim();
      const title = String(body.title ?? "").trim();
      const agency = String(body.agency ?? "").trim();
      const status = String(body.status ?? "").trim();

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

      const item = await GovernmentReport.findOne({ _id: itemId, siteId });
      if (!item) {
        throw NOT_FOUND("인허가 신고");
      }

      item.reportType = reportType;
      item.title = title;
      item.agency = agency;
      item.status = status;
      item.reportDate = parseDate(body.reportDate, "신고일");
      await item.save();

      await logUpdate(siteId, "safety_management_setup", itemId, { userId: null, userName: "system" });
      return success(item);
    }

    const item = await SafetyManagerAssignment.findOne({ _id: itemId, siteId, isActive: true });
    if (!item) {
      throw NOT_FOUND("안전관리자 선임");
    }

    const userIdRaw = String(body.userId ?? "").trim();
    if (userIdRaw) {
      const member = await resolveMember(siteId, userIdRaw);
      item.userId = new mongoose.Types.ObjectId(member.userId);
      item.sitePersonnelId = undefined;
      item.managerName = member.managerName;
    } else if (!item.userId && !item.sitePersonnelId) {
      item.managerName = String(body.managerName ?? item.managerName).trim();
      if (!item.managerName) {
        throw VALIDATION_ERROR("userId 선택이 필요합니다.");
      }
    }
    item.position = String(body.position ?? item.position).trim();
    item.role = String(body.role ?? item.role).trim();
    item.certificationNo = String(body.certificationNo ?? "").trim();
    item.assignedDate = parseDate(body.assignedDate, "선임일");
    await item.save();

    await logUpdate(siteId, "safety_management_setup", itemId, { userId: null, userName: "system" });
    return success(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectDB();

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const siteId = String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    const recordType = parseRecordType(request.nextUrl.searchParams.get("recordType"));

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    if (recordType === "report") {
      const item = await GovernmentReport.findOne({ _id: itemId, siteId });
      if (!item) {
        throw NOT_FOUND("인허가 신고");
      }

      await item.softDelete();
      await logDelete(siteId, "safety_management_setup", itemId, { userId: null, userName: "system" });
      return success({ id: itemId, deleted: true });
    }

    const item = await SafetyManagerAssignment.findOne({ _id: itemId, siteId, isActive: true });
    if (!item) {
      throw NOT_FOUND("안전관리자 선임");
    }

    item.isActive = false;
    await item.softDelete();
    await logDelete(siteId, "safety_management_setup", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

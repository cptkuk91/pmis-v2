import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SafetyChecklist from "@/models/SafetyChecklist";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import SiteMembership from "@/models/SiteMembership";
import { isSafetyChecklistCategory } from "@/lib/safety-checklist-category";

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();
    const siteId = (await resolveSiteId(request)) || request.nextUrl.searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      SafetyChecklist.find({ siteId }).sort({ checkDate: -1 }).skip(skip).limit(limit),
      SafetyChecklist.countDocuments({ siteId }),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();
    const body = (await request.json()) as Record<string, unknown>;
    const siteId = (await resolveSiteId(request)) || String(body.siteId ?? "").trim();
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const title = String(body.title ?? "").trim();
    const inspector = String(body.inspector ?? "").trim();
    const category = String(body.category ?? "").trim();
    const inspectorUserIdRaw = String(body.inspectorUserId ?? "").trim();
    const overallResult = String(body.overallResult ?? "").trim();

    if (!title) {
      throw VALIDATION_ERROR("제목은 필수입니다.");
    }
    if (!inspector) {
      throw VALIDATION_ERROR("점검자는 필수입니다.");
    }
    if (!inspectorUserIdRaw || !mongoose.Types.ObjectId.isValid(inspectorUserIdRaw)) {
      throw VALIDATION_ERROR("점검자 선택이 필요합니다.");
    }
    if (!isSafetyChecklistCategory(category)) {
      throw VALIDATION_ERROR("category 값이 올바르지 않습니다.");
    }
    if (overallResult !== "pass" && overallResult !== "fail") {
      throw VALIDATION_ERROR("결과는 합격 또는 불합격만 선택할 수 있습니다.");
    }

    const inspectorMembership = await SiteMembership.findOne({
      siteId: new mongoose.Types.ObjectId(siteId),
      userId: new mongoose.Types.ObjectId(inspectorUserIdRaw),
      isActive: true,
      isDeleted: false,
    })
      .select({ _id: 1 })
      .lean();

    if (!inspectorMembership) {
      throw VALIDATION_ERROR("현재 현장에 배정된 점검자를 선택해 주세요.");
    }

    const doc = await SafetyChecklist.create({
      siteId,
      title,
      checkDate: body.checkDate ? new Date(String(body.checkDate)) : new Date(),
      inspectorUserId: new mongoose.Types.ObjectId(inspectorUserIdRaw),
      inspector,
      category,
      items: Array.isArray(body.items) ? body.items : [],
      overallResult,
      remarks: String(body.remarks ?? "").trim(),
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    await logCreate(siteId, "safety_checklist", String(doc._id), requester);

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

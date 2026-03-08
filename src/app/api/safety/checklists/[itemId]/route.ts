import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SafetyChecklist from "@/models/SafetyChecklist";
import SiteMembership from "@/models/SiteMembership";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { isSafetyChecklistCategory } from "@/lib/safety-checklist-category";

type Params = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = (await resolveSiteId(request)) || String(body.siteId ?? "").trim();
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const item = await SafetyChecklist.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("점검 체크리스트");
    }

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

    item.title = title;
    item.checkDate = body.checkDate ? new Date(String(body.checkDate)) : item.checkDate;
    item.inspectorUserId = new mongoose.Types.ObjectId(inspectorUserIdRaw);
    item.inspector = inspector;
    item.category = category;
    item.overallResult = overallResult;
    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.save();

    await logUpdate(String(siteId), "safety_checklist", itemId, requester);
    return success(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const item = await SafetyChecklist.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("점검 체크리스트");
    }

    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.softDelete();
    await logDelete(String(siteId), "safety_checklist", itemId, requester);
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

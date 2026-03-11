import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logStatusChange } from "@/lib/audit-logger";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import {
  isSupplierApprovalStatus,
  type SupplierApprovalStatus,
} from "@/lib/supplier-approval";
import SupplierApprovalRequest from "@/models/SupplierApprovalRequest";

type Params = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
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

    const item = await SupplierApprovalRequest.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("업체 승인 요청");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const statusInput = String(body.status ?? "").trim().toLowerCase();
    if (!isSupplierApprovalStatus(statusInput)) {
      throw VALIDATION_ERROR("허용되지 않은 상태입니다.");
    }

    const nextStatus = statusInput as SupplierApprovalStatus;
    if (nextStatus === item.status) {
      throw new ApiError("이미 해당 상태입니다.", 409, "SUPPLIER_APPROVAL_STATUS_UNCHANGED");
    }
    if ((nextStatus === "approved" || nextStatus === "rejected") && item.status !== "pending") {
      throw new ApiError("대기 상태 요청만 승인 또는 반려할 수 있습니다.", 409, "SUPPLIER_APPROVAL_INVALID_TRANSITION");
    }
    if (nextStatus === "pending" && item.status !== "approved") {
      throw new ApiError("승인 상태 요청만 승인 취소할 수 있습니다.", 409, "SUPPLIER_APPROVAL_RESET_NOT_ALLOWED");
    }

    const rejectionReason = String(body.rejectionReason ?? "").trim();
    if (nextStatus === "rejected" && !rejectionReason) {
      throw VALIDATION_ERROR("반려 사유를 입력해 주세요.");
    }

    const requesterObjectId =
      requester.userId && mongoose.Types.ObjectId.isValid(requester.userId)
        ? new mongoose.Types.ObjectId(requester.userId)
        : undefined;
    const previousStatus = item.status;

    item.status = nextStatus;
    item.updatedBy = requesterObjectId;

    if (nextStatus === "approved") {
      item.approvedAt = new Date();
      item.approvedBy = requesterObjectId;
      item.rejectionReason = undefined;
    } else if (nextStatus === "pending") {
      item.approvedAt = undefined;
      item.approvedBy = undefined;
      item.rejectionReason = undefined;
    } else {
      item.approvedAt = undefined;
      item.approvedBy = undefined;
      item.rejectionReason = rejectionReason;
    }

    await item.save();
    await logStatusChange(String(siteId), "supplier_approval", itemId, requester, previousStatus, nextStatus);

    return success(item);
  } catch (err) {
    return handleApiError(err);
  }
}

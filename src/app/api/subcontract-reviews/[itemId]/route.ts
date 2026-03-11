import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { connectDB } from "@/lib/db";
import { logDelete, logStatusChange, logUpdate } from "@/lib/audit-logger";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { normalizeSubcontractReviewPayload } from "@/lib/subcontract-review";
import SubcontractReview from "@/models/SubcontractReview";
import SubcontractReviewItem from "@/models/SubcontractReviewItem";

type ReviewStatus = "pending" | "approved" | "rejected";

type Params = {
  params: Promise<{ itemId: string }>;
};

function isReviewStatus(value: string): value is ReviewStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function toObjectId(value: string | null | undefined) {
  return value && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : undefined;
}

async function getSiteId(request: NextRequest) {
  const querySiteId = request.nextUrl.searchParams.get("siteId");
  return querySiteId || (await resolveSiteId(request));
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await getSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const review = await SubcontractReview.findOne({ _id: itemId, siteId }).lean();
    if (!review) {
      throw NOT_FOUND("협력사 검토요청");
    }

    const items = await SubcontractReviewItem.find({
      reviewId: review._id,
      siteId,
    })
      .sort({ itemNo: 1, createdAt: 1 })
      .lean();

    return success({
      ...review,
      items,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await getSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const review = await SubcontractReview.findOne({ _id: itemId, siteId });
    if (!review) {
      throw NOT_FOUND("협력사 검토요청");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const requesterObjectId = toObjectId(requester.userId);

    if (body.status !== undefined) {
      const statusInput = String(body.status ?? "").trim().toLowerCase();
      if (!isReviewStatus(statusInput)) {
        throw VALIDATION_ERROR("허용되지 않은 상태입니다.");
      }

      const nextStatus = statusInput as ReviewStatus;
      if (nextStatus === review.status) {
        throw new ApiError("이미 해당 상태입니다.", 409, "SUBCONTRACT_REVIEW_STATUS_UNCHANGED");
      }
      if ((nextStatus === "approved" || nextStatus === "rejected") && review.status !== "pending") {
        throw new ApiError(
          "대기 상태 요청만 승인 또는 반려할 수 있습니다.",
          409,
          "SUBCONTRACT_REVIEW_INVALID_TRANSITION",
        );
      }
      if (nextStatus === "pending" && review.status !== "approved") {
        throw new ApiError(
          "승인 상태 요청만 승인 취소할 수 있습니다.",
          409,
          "SUBCONTRACT_REVIEW_RESET_NOT_ALLOWED",
        );
      }

      const rejectionReason = String(body.rejectionReason ?? "").trim();
      if (nextStatus === "rejected" && !rejectionReason) {
        throw VALIDATION_ERROR("반려 사유를 입력해 주세요.");
      }

      const previousStatus = review.status;
      review.status = nextStatus;
      review.updatedBy = requesterObjectId;

      if (nextStatus === "approved") {
        review.approvedDate = new Date();
        review.approvedBy = requesterObjectId;
        review.rejectionReason = undefined;
      } else if (nextStatus === "pending") {
        review.approvedDate = undefined;
        review.approvedBy = undefined;
        review.rejectionReason = undefined;
      } else {
        review.approvedDate = undefined;
        review.approvedBy = undefined;
        review.rejectionReason = rejectionReason;
      }

      await review.save();
      await logStatusChange(
        String(siteId),
        "subcontract_review",
        itemId,
        requester,
        previousStatus,
        nextStatus,
      );

      return success(review);
    }

    if (review.status === "approved") {
      throw new ApiError(
        "승인 상태 요청은 승인 취소 후 수정할 수 있습니다.",
        409,
        "SUBCONTRACT_REVIEW_EDIT_NOT_ALLOWED",
      );
    }

    const payload = await normalizeSubcontractReviewPayload({ ...body, siteId });
    const previousStatus = review.status;

    review.title = payload.title;
    review.contractorName = payload.contractorName;
    review.workType = payload.workType || undefined;
    review.contractAmount = payload.contractAmount;
    review.requestDate = payload.requestDate;
    review.remarks = payload.remarks || undefined;
    review.updatedBy = requesterObjectId;

    if (review.status !== "pending") {
      review.status = "pending";
      review.approvedDate = undefined;
      review.approvedBy = undefined;
      review.rejectionReason = undefined;
    }

    await review.save();

    await SubcontractReviewItem.updateMany(
      { reviewId: review._id, siteId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: requesterObjectId ?? null,
        },
      },
    );

    if (payload.items.length > 0) {
      await SubcontractReviewItem.insertMany(
        payload.items.map((item, index) => ({
          siteId: payload.siteId,
          reviewId: review._id,
          itemNo: index + 1,
          checkItem: item.checkItem,
          result: item.result,
          remarks: item.remarks || undefined,
          createdBy: requesterObjectId,
          updatedBy: requesterObjectId,
        })),
      );
    }

    const items = await SubcontractReviewItem.find({
      reviewId: review._id,
      siteId,
    })
      .sort({ itemNo: 1, createdAt: 1 })
      .lean();

    await logUpdate(String(siteId), "subcontract_review", itemId, requester, {
      updatedFields: Object.keys(body),
      previousStatus,
      nextStatus: review.status,
    });

    return success({
      ...review.toObject(),
      items,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await getSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const review = await SubcontractReview.findOne({ _id: itemId, siteId });
    if (!review) {
      throw NOT_FOUND("협력사 검토요청");
    }

    const requesterObjectId = toObjectId(requester.userId);
    review.updatedBy = requesterObjectId;
    await review.softDelete();

    await SubcontractReviewItem.updateMany(
      { reviewId: review._id, siteId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: requesterObjectId ?? null,
        },
      },
    );

    await logDelete(String(siteId), "subcontract_review", itemId, requester);
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

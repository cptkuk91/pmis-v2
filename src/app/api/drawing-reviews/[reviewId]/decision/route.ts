import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logStatusChange } from "@/lib/audit-logger";
import DrawingReview from "@/models/DrawingReview";

type Params = {
  params: Promise<{ reviewId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("site_admin");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { reviewId } = await params;
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw VALIDATION_ERROR("reviewId 형식이 올바르지 않습니다.");
    }

    const review = await DrawingReview.findOne({ _id: reviewId, siteId });
    if (!review) {
      throw NOT_FOUND("도면 검토 요청");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const decisionStatus = String(body.decisionStatus ?? "").trim();
    if (decisionStatus !== "approved" && decisionStatus !== "rejected") {
      throw VALIDATION_ERROR("decisionStatus는 approved 또는 rejected만 가능합니다.");
    }

    review.decisionStatus = decisionStatus;
    const decisionComment = String(body.decisionComment ?? "").trim();
    assertNoUnsafeHtml(decisionComment, "검토내용");
    review.decisionComment = decisionComment;
    review.reviewerName = String(body.reviewerName ?? requester.userName).trim();
    review.decidedAt = new Date();
    review.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await review.save();

    logStatusChange(siteId, "drawing_review", reviewId, requester, "pending", decisionStatus);
    return success(review);
  } catch (err) {
    return handleApiError(err);
  }
}

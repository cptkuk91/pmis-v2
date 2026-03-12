import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import { isDrawingDiscipline } from "@/lib/drawing-discipline";
import DrawingReview from "@/models/DrawingReview";

type Params = {
  params: Promise<{ reviewId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { reviewId } = await params;
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw VALIDATION_ERROR("reviewId 형식이 올바르지 않습니다.");
    }

    const review = await DrawingReview.findOne({ _id: reviewId, siteId }).lean();
    if (!review) {
      throw NOT_FOUND("도면 검토 요청");
    }

    return success(review);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
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
    const nextDocNo = body.docNo === undefined ? undefined : String(body.docNo ?? "").trim();
    const nextDrawingNo = body.drawingNo === undefined ? undefined : String(body.drawingNo ?? "").trim();
    const nextDrawingName = body.drawingName === undefined ? undefined : String(body.drawingName ?? "").trim();

    if (nextDocNo !== undefined && nextDocNo !== review.docNo) {
      throw VALIDATION_ERROR("문서번호는 자동 생성되어 수정할 수 없습니다.");
    }
    if (nextDrawingNo !== undefined && !nextDrawingNo) {
      throw VALIDATION_ERROR("도면번호는 비워둘 수 없습니다.");
    }
    if (nextDrawingName !== undefined && !nextDrawingName) {
      throw VALIDATION_ERROR("도면명은 비워둘 수 없습니다.");
    }
    if (nextDrawingNo !== undefined) {
      review.drawingNo = nextDrawingNo;
    }
    if (nextDrawingName !== undefined) {
      review.drawingName = nextDrawingName;
    }
    if (body.discipline !== undefined) {
      const nextDiscipline = String(body.discipline ?? "").trim();
      if (!isDrawingDiscipline(nextDiscipline)) {
        throw VALIDATION_ERROR("기술구분 값이 올바르지 않습니다.");
      }
      review.discipline = nextDiscipline;
    }
    if (body.location !== undefined) {
      review.location = String(body.location ?? "").trim();
    }
    if (body.requesterName !== undefined) {
      review.requesterName = String(body.requesterName ?? "").trim();
    }
    if (body.reviewerName !== undefined) {
      review.reviewerName = String(body.reviewerName ?? "").trim();
    }
    if (body.requestedAt !== undefined) {
      review.requestedAt = new Date(String(body.requestedAt));
    }
    if (body.requestContent !== undefined) {
      review.requestContent = String(body.requestContent ?? "").trim();
    }
    if (body.classificationCode !== undefined) {
      review.classificationCode = String(body.classificationCode ?? "").trim();
    }
    review.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await review.save();

    logUpdate(siteId, "drawing_review", reviewId, requester, { updatedFields: Object.keys(body) });
    return success(review);
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

    const { reviewId } = await params;
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw VALIDATION_ERROR("reviewId 형식이 올바르지 않습니다.");
    }

    const review = await DrawingReview.findOne({ _id: reviewId, siteId });
    if (!review) {
      throw NOT_FOUND("도면 검토 요청");
    }

    review.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await review.softDelete();

    logDelete(siteId, "drawing_review", reviewId, requester);
    return success({ id: reviewId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

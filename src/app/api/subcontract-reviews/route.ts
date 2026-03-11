import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SubcontractReview from "@/models/SubcontractReview";
import SubcontractReviewItem from "@/models/SubcontractReviewItem";
import { success, paginated } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { normalizeSubcontractReviewPayload } from "@/lib/subcontract-review";

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();
    const { searchParams } = request.nextUrl;
    const querySiteId = searchParams.get("siteId");
    const siteId = querySiteId || (await resolveSiteId(request));
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const filter: Record<string, unknown> = { siteId };
    if (status) filter.status = status;

    const [data, total] = await Promise.all([
      SubcontractReview.find(filter).sort({ requestDate: -1 }).skip(skip).limit(limit),
      SubcontractReview.countDocuments(filter),
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
    const body = await request.json();
    const siteId = (await resolveSiteId(request)) || String(body.siteId ?? "");
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const payload = await normalizeSubcontractReviewPayload({ ...body, siteId });

    const review = await SubcontractReview.create({
      siteId: payload.siteId,
      title: payload.title,
      contractorName: payload.contractorName,
      workType: payload.workType || undefined,
      contractAmount: payload.contractAmount,
      requestDate: payload.requestDate,
      remarks: payload.remarks || undefined,
      requestedBy: requester.userId ?? undefined,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    if (payload.items.length > 0) {
      await SubcontractReviewItem.insertMany(
        payload.items.map((item, index) => ({
          siteId: payload.siteId,
          reviewId: review._id,
          itemNo: index + 1,
          checkItem: item.checkItem,
          result: item.result,
          remarks: item.remarks || undefined,
          createdBy: requester.userId ?? undefined,
          updatedBy: requester.userId ?? undefined,
        })),
      );
    }

    await logCreate(String(siteId), "subcontract_review", String(review._id), requester);
    return success(review);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SubcontractReview from "@/models/SubcontractReview";
import SubcontractReviewItem from "@/models/SubcontractReviewItem";
import { success, paginated } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";

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

    const { items, ...reviewData } = body;
    const title = String(reviewData.title ?? "").trim();
    const contractorName = String(reviewData.contractorName ?? "").trim();
    if (!title) {
      throw VALIDATION_ERROR("검토요청 제목은 필수입니다.");
    }
    if (!contractorName) {
      throw VALIDATION_ERROR("업체명은 필수입니다.");
    }
    assertNoUnsafeHtml(title, "검토요청 제목");
    assertNoUnsafeHtml(contractorName, "업체명");

    const review = await SubcontractReview.create({
      ...reviewData,
      siteId,
      title,
      contractorName,
      requestDate: reviewData.requestDate ? new Date(reviewData.requestDate) : new Date(),
      requestedBy: requester.userId ?? undefined,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    if (Array.isArray(items) && items.length > 0) {
      const normalizedItems = items.reduce<
        Array<{
          siteId: string;
          reviewId: typeof review._id;
          itemNo: number;
          checkItem: string;
          result: string;
          remarks?: string;
          createdBy?: string;
          updatedBy?: string;
        }>
      >((acc, item: { checkItem: string; result?: string; remarks?: string }, idx: number) => {
        const checkItem = String(item.checkItem ?? "").trim();
        const remarks = String(item.remarks ?? "").trim();
        if (!checkItem) {
          return acc;
        }
        assertNoUnsafeHtml(checkItem, `검토항목(${idx + 1})`);
        assertNoUnsafeHtml(remarks, `검토의견(${idx + 1})`);
        acc.push({
          siteId,
          reviewId: review._id,
          itemNo: idx + 1,
          checkItem,
          result: item.result || "na",
          remarks: remarks || undefined,
          createdBy: requester.userId ?? undefined,
          updatedBy: requester.userId ?? undefined,
        });
        return acc;
      }, []);

      await SubcontractReviewItem.insertMany(
        normalizedItems,
      );
    }

    await logCreate(String(siteId), "subcontract_review", String(review._id), requester);
    return success(review);
  } catch (err) {
    return handleApiError(err);
  }
}

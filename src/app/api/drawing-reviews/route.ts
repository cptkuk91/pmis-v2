import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import DrawingReview from "@/models/DrawingReview";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all");
    const sort = request.nextUrl.searchParams.get("sort") ?? "latest";
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { docNo: regex },
        { drawingNo: regex },
        { drawingName: regex },
        { requesterName: regex },
        { reviewerName: regex },
        { requestContent: regex },
      ];
    }
    if (status === "pending" || status === "approved" || status === "rejected") {
      filter.decisionStatus = status;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      latest: { requestedAt: -1, createdAt: -1 },
      oldest: { requestedAt: 1, createdAt: 1 },
      doc_asc: { docNo: 1 },
      doc_desc: { docNo: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.latest;

    const [items, total] = await Promise.all([
      DrawingReview.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      DrawingReview.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const docNo = String(body.docNo ?? "").trim();
    const drawingNo = String(body.drawingNo ?? "").trim();
    const drawingName = String(body.drawingName ?? "").trim();

    if (!docNo) {
      throw VALIDATION_ERROR("문서번호는 필수입니다.");
    }
    if (!drawingNo) {
      throw VALIDATION_ERROR("도면번호는 필수입니다.");
    }
    if (!drawingName) {
      throw VALIDATION_ERROR("도면명은 필수입니다.");
    }
    assertNoUnsafeHtml(docNo, "문서번호");
    assertNoUnsafeHtml(drawingNo, "도면번호");
    assertNoUnsafeHtml(drawingName, "도면명");

    const created = await DrawingReview.create({
      siteId,
      docNo,
      drawingNo,
      drawingName,
      discipline: String(body.discipline ?? "건축").trim(),
      location: String(body.location ?? "").trim(),
      requesterName: String(body.requesterName ?? requester.userName).trim(),
      reviewerName: String(body.reviewerName ?? "").trim(),
      requestedAt: body.requestedAt ? new Date(String(body.requestedAt)) : new Date(),
      decisionStatus: "pending",
      requestContent: String(body.requestContent ?? "").trim(),
      classificationCode: String(body.classificationCode ?? "").trim(),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    logCreate(siteId, "drawing_review", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

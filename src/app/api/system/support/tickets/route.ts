import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import SupportTicket from "@/models/SupportTicket";

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

async function generateTicketNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `SUP-${y}${m}${d}`;
  const count = await SupportTicket.countDocuments({
    ticketNo: { $regex: new RegExp(`^${prefix}-`) },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
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
    const skip = (page - 1) * limit;
    const status = String(request.nextUrl.searchParams.get("status") ?? "all");
    const category = String(request.nextUrl.searchParams.get("category") ?? "all");
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();

    const filter: Record<string, unknown> = {
      isDeleted: { $ne: true },
      $or: [{ siteId: new mongoose.Types.ObjectId(siteId) }, { siteId: null }],
    };
    if (status !== "all") {
      filter.status = status;
    }
    if (category !== "all") {
      filter.category = category;
    }
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$and = [{ $or: [{ ticketNo: regex }, { title: regex }, { reporterName: regex }] }];
    }

    const [items, total] = await Promise.all([
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    const body = (await request.json()) as Record<string, unknown>;

    const category = String(body.category ?? "").trim();
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    const reporterName = String(body.reporterName ?? requester.userName ?? "").trim();
    const reporterEmail = String(body.reporterEmail ?? "").trim();
    const priority = String(body.priority ?? "medium").trim();

    if (!["bug", "feature", "inquiry", "complaint"].includes(category)) {
      throw VALIDATION_ERROR("category는 bug|feature|inquiry|complaint 중 하나여야 합니다.");
    }
    if (!title) {
      throw VALIDATION_ERROR("title은 필수입니다.");
    }
    if (!content) {
      throw VALIDATION_ERROR("content는 필수입니다.");
    }
    if (!["low", "medium", "high", "urgent"].includes(priority)) {
      throw VALIDATION_ERROR("priority 값이 올바르지 않습니다.");
    }
    if (!reporterEmail) {
      throw VALIDATION_ERROR("reporterEmail은 필수입니다.");
    }
    assertNoUnsafeHtml(title, "제목");
    assertNoUnsafeHtml(content, "내용");

    const ticketNo = await generateTicketNo();

    const created = await SupportTicket.create({
      siteId: siteId ? new mongoose.Types.ObjectId(siteId) : undefined,
      ticketNo,
      category,
      priority,
      status: "open",
      title,
      content,
      reporterName,
      reporterEmail,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(siteId ?? "", "support_ticket", String(created._id), requester);

    return success(created);
  } catch (err) {
    if (err instanceof ApiError) {
      return handleApiError(err);
    }
    return handleApiError(err);
  }
}

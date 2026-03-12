import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import {
  isQaCapaActionType,
  isQaCapaEscalated,
  isQaCapaOverdue,
  isQaCapaPriority,
  isQaCapaSourceType,
  isQaCapaStatus,
} from "@/lib/qa-capa";
import { resolveQaCapaAuditSource, linkQaCapaToAudit } from "@/lib/qa-capa-audit-link";
import { normalizeQaCapaPayload } from "@/lib/qa-capa-payload";
import QaCapa from "@/models/QaCapa";

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

type QaCapaSort = "due_asc" | "due_desc" | "created_desc" | "status_asc";

function parseCapaSort(value: string): QaCapaSort {
  if (value === "due_asc" || value === "due_desc" || value === "created_desc" || value === "status_asc") {
    return value;
  }
  throw VALIDATION_ERROR("정렬 값이 올바르지 않습니다.");
}

function getCapaSort(sort: QaCapaSort): Record<string, 1 | -1> {
  switch (sort) {
    case "due_desc":
      return { dueDate: -1, createdAt: -1 };
    case "created_desc":
      return { createdAt: -1 };
    case "status_asc":
      return { status: 1, dueDate: 1, createdAt: -1 };
    case "due_asc":
    default:
      return { dueDate: 1, createdAt: -1 };
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([], {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        summary: {
          activeCount: 0,
          verificationCount: 0,
          overdueCount: 0,
          escalatedCount: 0,
        },
      });
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const actionType = String(request.nextUrl.searchParams.get("actionType") ?? "all").trim();
    const priority = String(request.nextUrl.searchParams.get("priority") ?? "all").trim();
    const sourceType = String(request.nextUrl.searchParams.get("sourceType") ?? "all").trim();
    const overdueOnly = String(request.nextUrl.searchParams.get("overdueOnly") ?? "false").trim() === "true";
    const escalationOnly = String(request.nextUrl.searchParams.get("escalationOnly") ?? "false").trim() === "true";
    const sort = parseCapaSort(String(request.nextUrl.searchParams.get("sort") ?? "due_asc").trim());
    const skip = (page - 1) * limit;

    const siteObjectId = new mongoose.Types.ObjectId(siteId);
    const filter: Record<string, unknown> = { siteId: siteObjectId };

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { title: regex },
        { sourceSummary: regex },
        { sourceAuditTitle: regex },
        { sourceChecklistTitle: regex },
        { rootCauseSummary: regex },
        { actionPlan: regex },
        { assigneeName: regex },
        { verifierName: regex },
      ];
    }
    if (status !== "all") {
      if (!isQaCapaStatus(status)) {
        throw VALIDATION_ERROR("상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }
    if (actionType !== "all") {
      if (!isQaCapaActionType(actionType)) {
        throw VALIDATION_ERROR("조치 유형 필터 값이 올바르지 않습니다.");
      }
      filter.actionType = actionType;
    }
    if (priority !== "all") {
      if (!isQaCapaPriority(priority)) {
        throw VALIDATION_ERROR("우선순위 필터 값이 올바르지 않습니다.");
      }
      filter.priority = priority;
    }
    if (sourceType !== "all") {
      if (!isQaCapaSourceType(sourceType)) {
        throw VALIDATION_ERROR("출처 필터 값이 올바르지 않습니다.");
      }
      filter.sourceType = sourceType;
    }

    const summaryRowsPromise = QaCapa.find({ siteId: siteObjectId })
      .select({ status: 1, dueDate: 1, priority: 1 })
      .lean();

    let items: unknown[] = [];
    let total = 0;

    if (overdueOnly || escalationOnly) {
      const rows = await QaCapa.find(filter).sort(getCapaSort(sort)).lean();
      const refined = rows.filter((item) => {
        const overdue = isQaCapaOverdue(item.dueDate, item.status);
        const escalated = isQaCapaEscalated(item.priority, item.status, item.dueDate);
        if (overdueOnly && !overdue) {
          return false;
        }
        if (escalationOnly && !escalated) {
          return false;
        }
        return true;
      });
      total = refined.length;
      items = refined.slice(skip, skip + limit);
    } else {
      const [rows, rowCount] = await Promise.all([
        QaCapa.find(filter).sort(getCapaSort(sort)).skip(skip).limit(limit).lean(),
        QaCapa.countDocuments(filter),
      ]);
      items = rows;
      total = rowCount;
    }

    const summaryRows = await summaryRowsPromise;
    const summary = summaryRows.reduce(
      (acc, row) => {
        if (row.status !== "completed") {
          acc.activeCount += 1;
        }
        if (row.status === "verification") {
          acc.verificationCount += 1;
        }
        if (isQaCapaOverdue(row.dueDate, row.status)) {
          acc.overdueCount += 1;
        }
        if (isQaCapaEscalated(row.priority, row.status, row.dueDate)) {
          acc.escalatedCount += 1;
        }
        return acc;
      },
      { activeCount: 0, verificationCount: 0, overdueCount: 0, escalatedCount: 0 },
    );

    return success(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      summary,
    });
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
    const payload = normalizeQaCapaPayload(body);

    let sourceMeta = {
      sourceSummary: payload.sourceSummary,
      sourceAuditTitle: "",
      sourceChecklistSection: "",
      sourceChecklistTitle: "",
    };
    if (payload.sourceType === "audit") {
      sourceMeta = await resolveQaCapaAuditSource(siteId, payload.sourceAuditId, payload.sourceChecklistId);
    }

    const created = await QaCapa.create({
      ...payload,
      ...sourceMeta,
      siteId,
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    if (payload.sourceType === "audit") {
      await linkQaCapaToAudit({
        siteId,
        auditId: payload.sourceAuditId,
        checklistId: payload.sourceChecklistId,
        capaId: String(created._id),
        updatedByUserId: requester.userId,
      });
    }

    logCreate(siteId, "qa_capa", String(created._id), requester, {
      sourceType: payload.sourceType,
      actionType: payload.actionType,
      priority: payload.priority,
      status: payload.status,
    });

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

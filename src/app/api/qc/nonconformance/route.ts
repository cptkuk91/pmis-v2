import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { getFileAssetLinkMap } from "@/lib/file-asset-links";
import { generateNextQcNonconformanceNo } from "@/lib/qc-nonconformance-no";
import {
  getQcNonconformanceSort,
  isQcNonconformanceSeverity,
  isQcNonconformanceSort,
  isQcNonconformanceSourceType,
  isQcNonconformanceStatus,
} from "@/lib/qc-nonconformance";
import { normalizeQcNonconformancePayload } from "@/lib/qc-nonconformance-payload";
import {
  resolveQcNonconformanceReferences,
  syncQcNonconformanceLinks,
  validateQcNonconformanceLifecycle,
  type QcNonconformanceReferenceSnapshot,
} from "@/lib/qc-nonconformance-record";
import QcNonconformance from "@/models/QcNonconformance";

type QcNonconformanceLean = {
  _id: unknown;
  siteId: unknown;
  ncrNo?: string;
  occurrenceType?: string;
  sourceType?: string;
  severity?: string;
  severityRank?: number;
  title?: string;
  description?: string;
  occurrenceDate?: Date | null;
  location?: string;
  workType?: string;
  sourceSummary?: string;
  linkedMaterialInspectionId?: mongoose.Types.ObjectId | null;
  linkedMaterialInspectionTitle?: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId | null;
  linkedProcessInspectionTitle?: string;
  linkedTestReportId?: mongoose.Types.ObjectId | null;
  linkedTestReportTitle?: string;
  reporterName?: string;
  assigneeName?: string;
  assigneeMemberId?: string;
  verifierName?: string;
  verifierMemberId?: string;
  dueDate?: Date | null;
  status?: string;
  rootCauseSummary?: string;
  containmentAction?: string;
  correctiveActionPlan?: string;
  preventiveAction?: string;
  actionTaken?: string;
  verificationResult?: string;
  verificationNote?: string;
  verifiedAt?: Date | null;
  closedAt?: Date | null;
  attachments?: Array<{
    fileAssetId?: mongoose.Types.ObjectId | null;
    fileName?: string;
    category?: string;
    sortOrder?: number;
  }>;
  history?: Array<{
    actionType?: string;
    status?: string;
    verificationResult?: string;
    note?: string;
    actorName?: string;
    actionDate?: Date | null;
  }>;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

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

function mapAttachments(
  item: QcNonconformanceLean,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return (item.attachments ?? [])
    .map((attachment) => {
      const fileAssetId = String(attachment.fileAssetId ?? "").trim();
      if (!fileAssetId) {
        return null;
      }
      const fileLink = fileAssetLinkMap.get(fileAssetId);
      return {
        fileAssetId,
        fileName: attachment.fileName ?? fileLink?.originalName ?? fileAssetId,
        fileUrl: fileLink?.url ?? "",
        category: attachment.category ?? "other",
        sortOrder: Number(attachment.sortOrder ?? 0),
      };
    })
    .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function serializeItem(
  item: QcNonconformanceLean,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return {
    ...item,
    _id: String(item._id),
    siteId: String(item.siteId ?? ""),
    linkedMaterialInspectionId: item.linkedMaterialInspectionId ? String(item.linkedMaterialInspectionId) : "",
    linkedProcessInspectionId: item.linkedProcessInspectionId ? String(item.linkedProcessInspectionId) : "",
    linkedTestReportId: item.linkedTestReportId ? String(item.linkedTestReportId) : "",
    attachments: mapAttachments(item, fileAssetLinkMap),
    history: (item.history ?? []).map((entry) => ({
      actionType: entry.actionType ?? "updated",
      status: entry.status ?? "open",
      verificationResult: entry.verificationResult ?? "pending",
      note: entry.note ?? "",
      actorName: entry.actorName ?? "",
      actionDate: entry.actionDate ? new Date(entry.actionDate).toISOString() : new Date(0).toISOString(),
    })),
  };
}

function buildReferenceSnapshot(item: {
  linkedMaterialInspectionId?: mongoose.Types.ObjectId | string | null;
  linkedProcessInspectionId?: mongoose.Types.ObjectId | string | null;
  linkedTestReportId?: mongoose.Types.ObjectId | string | null;
}): QcNonconformanceReferenceSnapshot {
  return {
    linkedMaterialInspectionId: item.linkedMaterialInspectionId ? String(item.linkedMaterialInspectionId) : "",
    linkedProcessInspectionId: item.linkedProcessInspectionId ? String(item.linkedProcessInspectionId) : "",
    linkedTestReportId: item.linkedTestReportId ? String(item.linkedTestReportId) : "",
  };
}

function buildSummaryFilters(
  filter: Record<string, unknown>,
  input: {
    status: string;
    severity: string;
    now: Date;
  },
) {
  const activeFilter: Record<string, unknown> | null =
    input.status === "closed"
      ? null
      : {
          ...filter,
          status: input.status || filter.status ? filter.status : { $ne: "closed" },
        };

  const verificationFilter: Record<string, unknown> | null =
    input.status && input.status !== "verification"
      ? null
      : {
          ...filter,
          status: "verification",
        };

  const overdueFilter: Record<string, unknown> | null =
    input.status === "closed"
      ? null
      : {
          ...filter,
          status: input.status || filter.status ? filter.status : { $ne: "closed" },
          dueDate: { $lt: input.now },
        };

  const criticalFilter: Record<string, unknown> | null =
    input.severity && input.severity !== "critical"
      ? null
      : {
          ...filter,
          severity: "critical",
        };

  return { activeFilter, verificationFilter, overdueFilter, criticalFilter };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId") || (await resolveSiteId(request));
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 10);
    const skip = (page - 1) * limit;
    const keyword = String(searchParams.get("q") ?? "").trim();
    const status = String(searchParams.get("status") ?? "").trim();
    const severity = String(searchParams.get("severity") ?? "").trim();
    const sourceType = String(searchParams.get("sourceType") ?? "").trim();
    const overdueOnly = String(searchParams.get("overdueOnly") ?? "") === "true";
    const sortRaw = String(searchParams.get("sort") ?? "due_asc").trim();
    const now = new Date();

    const filter: Record<string, unknown> = { siteId };
    if (status) {
      if (!isQcNonconformanceStatus(status)) {
        throw VALIDATION_ERROR("NCR 상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }
    if (severity) {
      if (!isQcNonconformanceSeverity(severity)) {
        throw VALIDATION_ERROR("NCR 심각도 필터 값이 올바르지 않습니다.");
      }
      filter.severity = severity;
    }
    if (sourceType) {
      if (!isQcNonconformanceSourceType(sourceType)) {
        throw VALIDATION_ERROR("NCR 출처 필터 값이 올바르지 않습니다.");
      }
      filter.sourceType = sourceType;
    }
    if (overdueOnly) {
      filter.status = { $ne: "closed" };
      filter.dueDate = { $lt: now };
    }
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { ncrNo: regex },
        { title: regex },
        { description: regex },
        { sourceSummary: regex },
        { location: regex },
        { workType: regex },
        { assigneeName: regex },
        { verifierName: regex },
        { linkedMaterialInspectionTitle: regex },
        { linkedProcessInspectionTitle: regex },
        { linkedTestReportTitle: regex },
      ];
    }

    const sort = isQcNonconformanceSort(sortRaw) ? sortRaw : "due_asc";
    const { activeFilter, verificationFilter, overdueFilter, criticalFilter } = buildSummaryFilters(filter, {
      status,
      severity,
      now,
    });
    const [rows, total, activeCount, verificationCount, overdueCount, criticalCount] = await Promise.all([
      QcNonconformance.find(filter)
        .sort(getQcNonconformanceSort(sort))
        .skip(skip)
        .limit(limit)
        .lean<Array<QcNonconformanceLean>>(),
      QcNonconformance.countDocuments(filter),
      activeFilter ? QcNonconformance.countDocuments(activeFilter) : Promise.resolve(0),
      verificationFilter ? QcNonconformance.countDocuments(verificationFilter) : Promise.resolve(0),
      overdueFilter ? QcNonconformance.countDocuments(overdueFilter) : Promise.resolve(0),
      criticalFilter ? QcNonconformance.countDocuments(criticalFilter) : Promise.resolve(0),
    ]);

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      rows.flatMap((item) => (item.attachments ?? []).map((attachment) => attachment.fileAssetId)),
    );

    return success(
      rows.map((item) => serializeItem(item, fileAssetLinkMap)),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        summary: {
          activeCount,
          verificationCount,
          overdueCount,
          criticalCount,
        },
      },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = (await resolveSiteId(request)) || String(body.siteId ?? "");
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const payload = normalizeQcNonconformancePayload(body);
    validateQcNonconformanceLifecycle({
      status: payload.status,
      verificationResult: payload.verificationResult,
      verifiedAt: payload.verifiedAt,
    });

    const referenceInfo = await resolveQcNonconformanceReferences(siteId, {
      sourceType: payload.sourceType,
      linkedMaterialInspectionId: payload.linkedMaterialInspectionId,
      linkedProcessInspectionId: payload.linkedProcessInspectionId,
      linkedTestReportId: payload.linkedTestReportId,
      sourceSummary: payload.sourceSummary,
    });
    const ncrNo = await generateNextQcNonconformanceNo(siteId, payload.occurrenceDate ?? new Date());
    const attachments = payload.attachments.map((attachment) => ({
      fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
      fileName: attachment.fileName,
      category: attachment.category,
      sortOrder: attachment.sortOrder,
    }));
    const closedAt = payload.status === "closed" ? payload.verifiedAt ?? new Date() : null;

    const doc = await QcNonconformance.create({
      siteId,
      ncrNo,
      occurrenceType: payload.occurrenceType,
      sourceType: payload.sourceType,
      severity: payload.severity,
      severityRank: payload.severityRank,
      title: payload.title,
      description: payload.description,
      occurrenceDate: payload.occurrenceDate ?? new Date(),
      location: payload.location,
      workType: payload.workType,
      sourceSummary: referenceInfo.sourceSummary,
      linkedMaterialInspectionId: referenceInfo.linkedMaterialInspectionId,
      linkedMaterialInspectionTitle: referenceInfo.linkedMaterialInspectionTitle,
      linkedProcessInspectionId: referenceInfo.linkedProcessInspectionId,
      linkedProcessInspectionTitle: referenceInfo.linkedProcessInspectionTitle,
      linkedTestReportId: referenceInfo.linkedTestReportId,
      linkedTestReportTitle: referenceInfo.linkedTestReportTitle,
      reporterName: requester.userName,
      assigneeName: payload.assigneeName,
      assigneeMemberId: payload.assigneeMemberId,
      verifierName: payload.verifierName,
      verifierMemberId: payload.verifierMemberId,
      dueDate: payload.dueDate ?? new Date(),
      status: payload.status,
      rootCauseSummary: payload.rootCauseSummary,
      containmentAction: payload.containmentAction,
      correctiveActionPlan: payload.correctiveActionPlan,
      preventiveAction: payload.preventiveAction,
      actionTaken: payload.actionTaken,
      verificationResult: payload.verificationResult,
      verificationNote: payload.verificationNote,
      verifiedAt: payload.verifiedAt,
      closedAt,
      attachments,
      history: [
        {
          actionType: "created",
          status: payload.status,
          verificationResult: payload.verificationResult,
          note: payload.historyNote || payload.description || payload.correctiveActionPlan || "",
          actorName: requester.userName,
          actionDate: new Date(),
        },
      ],
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    await syncQcNonconformanceLinks(
      siteId,
      { linkedMaterialInspectionId: "", linkedProcessInspectionId: "", linkedTestReportId: "" },
      buildReferenceSnapshot(doc),
      ncrNo,
    );

    logCreate(siteId, "qc_nonconformance", String(doc._id), requester, {
      ncrNo,
      sourceType: payload.sourceType,
      severity: payload.severity,
      status: payload.status,
    });

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (doc.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );

    return success(serializeItem(doc.toObject() as QcNonconformanceLean, fileAssetLinkMap));
  } catch (err) {
    return handleApiError(err);
  }
}

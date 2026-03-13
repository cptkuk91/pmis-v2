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
import { generateNextQcHandoverInspectionNo } from "@/lib/qc-handover-inspection-no";
import { normalizeQcHandoverInspectionPayload } from "@/lib/qc-handover-inspection-payload";
import {
  assertValidQcHandoverLifecycle,
  resolveQcHandoverInspectionReferences,
} from "@/lib/qc-handover-inspection-record";
import {
  getQcHandoverOpenFindingCount,
  getQcHandoverResult,
  getQcHandoverSort,
  isQcHandoverApprovalStatus,
  isQcHandoverInspectionType,
  isQcHandoverResult,
  isQcHandoverSort,
  isQcHandoverStatus,
} from "@/lib/qc-handover-inspections";
import QcHandoverInspection from "@/models/QcHandoverInspection";

type QcHandoverInspectionLean = {
  _id: unknown;
  siteId: unknown;
  inspectionNo?: string;
  inspectionType?: string;
  inspectionTitle?: string;
  workType?: string;
  areaType?: string;
  areaLabel?: string;
  unitNo?: string;
  zoneName?: string;
  plannedInspectionDate?: Date | null;
  inspectedAt?: Date | null;
  status?: string;
  result?: string;
  openFindingCount?: number;
  requesterName?: string;
  requesterMemberId?: string;
  inspectorName?: string;
  inspectorMemberId?: string;
  approverName?: string;
  approverMemberId?: string;
  approvalStatus?: string;
  approvedAt?: Date | null;
  approvalComment?: string;
  inspectionSummary?: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId | null;
  linkedProcessInspectionTitle?: string;
  linkedNcrId?: mongoose.Types.ObjectId | null;
  linkedNcrNo?: string;
  linkedNcrTitle?: string;
  checklistItems?: Array<{
    itemId?: string;
    sectionTitle?: string;
    checkpointTitle?: string;
    spaceLabel?: string;
    status?: string;
    note?: string;
    findingTitle?: string;
    correctiveRequest?: string;
    correctiveDueDate?: Date | null;
    findingStatus?: string;
    completionNote?: string;
  }>;
  attachments?: Array<{
    fileAssetId?: mongoose.Types.ObjectId | null;
    fileName?: string;
    category?: string;
    sortOrder?: number;
  }>;
  history?: Array<{
    actionType?: string;
    status?: string;
    approvalStatus?: string;
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
  item: QcHandoverInspectionLean,
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
  item: QcHandoverInspectionLean,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return {
    ...item,
    _id: String(item._id),
    siteId: String(item.siteId ?? ""),
    linkedProcessInspectionId: item.linkedProcessInspectionId ? String(item.linkedProcessInspectionId) : "",
    linkedNcrId: item.linkedNcrId ? String(item.linkedNcrId) : "",
    checklistItems: (item.checklistItems ?? []).map((checkItem) => ({
      itemId: checkItem.itemId ?? "",
      sectionTitle: checkItem.sectionTitle ?? "",
      checkpointTitle: checkItem.checkpointTitle ?? "",
      spaceLabel: checkItem.spaceLabel ?? "",
      status: checkItem.status ?? "pending",
      note: checkItem.note ?? "",
      findingTitle: checkItem.findingTitle ?? "",
      correctiveRequest: checkItem.correctiveRequest ?? "",
      correctiveDueDate: checkItem.correctiveDueDate ? new Date(checkItem.correctiveDueDate).toISOString() : null,
      findingStatus: checkItem.findingStatus ?? "none",
      completionNote: checkItem.completionNote ?? "",
    })),
    attachments: mapAttachments(item, fileAssetLinkMap),
    history: (item.history ?? []).map((entry) => ({
      actionType: entry.actionType ?? "updated",
      status: entry.status ?? "scheduled",
      approvalStatus: entry.approvalStatus ?? "none",
      note: entry.note ?? "",
      actorName: entry.actorName ?? "",
      actionDate: entry.actionDate ? new Date(entry.actionDate).toISOString() : new Date(0).toISOString(),
    })),
  };
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
    const inspectionType = String(searchParams.get("inspectionType") ?? "").trim();
    const status = String(searchParams.get("status") ?? "").trim();
    const approvalStatus = String(searchParams.get("approvalStatus") ?? "").trim();
    const result = String(searchParams.get("result") ?? "").trim();
    const unresolvedOnly = String(searchParams.get("unresolvedOnly") ?? "") === "true";
    const sortRaw = String(searchParams.get("sort") ?? "planned_date_desc").trim();

    const filter: Record<string, unknown> = { siteId };

    if (inspectionType) {
      if (!isQcHandoverInspectionType(inspectionType)) {
        throw VALIDATION_ERROR("검사 구분 필터 값이 올바르지 않습니다.");
      }
      filter.inspectionType = inspectionType;
    }

    if (status) {
      if (!isQcHandoverStatus(status)) {
        throw VALIDATION_ERROR("검사 상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }

    if (approvalStatus) {
      if (!isQcHandoverApprovalStatus(approvalStatus)) {
        throw VALIDATION_ERROR("승인 상태 필터 값이 올바르지 않습니다.");
      }
      filter.approvalStatus = approvalStatus;
    }

    if (result) {
      if (!isQcHandoverResult(result)) {
        throw VALIDATION_ERROR("검사 결과 필터 값이 올바르지 않습니다.");
      }
      filter.result = result;
    }

    if (unresolvedOnly) {
      filter.openFindingCount = { $gt: 0 };
    }

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { inspectionNo: regex },
        { inspectionTitle: regex },
        { workType: regex },
        { areaLabel: regex },
        { unitNo: regex },
        { zoneName: regex },
        { requesterName: regex },
        { inspectorName: regex },
        { approverName: regex },
        { linkedProcessInspectionTitle: regex },
        { linkedNcrNo: regex },
        { linkedNcrTitle: regex },
      ];
    }

    const sort = isQcHandoverSort(sortRaw) ? sortRaw : "planned_date_desc";
    const unresolvedFilter = { ...filter, openFindingCount: { $gt: 0 } };
    const approvalRequestedFilter = { ...filter, approvalStatus: "requested" };
    const closedFilter = { ...filter, status: "closed" };

    const [rows, total, unresolvedCount, approvalRequestedCount, closedCount] = await Promise.all([
      QcHandoverInspection.find(filter)
        .sort(getQcHandoverSort(sort))
        .skip(skip)
        .limit(limit)
        .lean<Array<QcHandoverInspectionLean>>(),
      QcHandoverInspection.countDocuments(filter),
      QcHandoverInspection.countDocuments(unresolvedFilter),
      QcHandoverInspection.countDocuments(approvalRequestedFilter),
      QcHandoverInspection.countDocuments(closedFilter),
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
          unresolvedCount,
          approvalRequestedCount,
          closedCount,
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

    const payload = normalizeQcHandoverInspectionPayload(body);
    const referenceInfo = await resolveQcHandoverInspectionReferences(siteId, {
      linkedProcessInspectionId: payload.linkedProcessInspectionId,
      linkedNcrId: payload.linkedNcrId,
    });
    const result = getQcHandoverResult(payload.checklistItems);
    const openFindingCount = getQcHandoverOpenFindingCount(payload.checklistItems);
    const approvedAt =
      payload.approvalStatus === "approved" ? payload.approvedAt ?? new Date() : null;

    assertValidQcHandoverLifecycle({
      status: payload.status,
      approvalStatus: payload.approvalStatus,
      openFindingCount,
      approvedAt,
    });

    const inspectionNo = await generateNextQcHandoverInspectionNo(
      siteId,
      payload.plannedInspectionDate ?? payload.inspectedAt ?? new Date(),
    );

    const attachments = payload.attachments.map((attachment) => ({
      fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
      fileName: attachment.fileName,
      category: attachment.category,
      sortOrder: attachment.sortOrder,
    }));

    const doc = await QcHandoverInspection.create({
      siteId,
      inspectionNo,
      inspectionType: payload.inspectionType,
      inspectionTitle: payload.inspectionTitle,
      workType: payload.workType,
      areaType: payload.areaType,
      areaLabel: payload.areaLabel,
      unitNo: payload.unitNo,
      zoneName: payload.zoneName,
      plannedInspectionDate: payload.plannedInspectionDate ?? new Date(),
      inspectedAt: payload.inspectedAt,
      status: payload.status,
      result,
      openFindingCount,
      requesterName: payload.requesterName || requester.userName,
      requesterMemberId: payload.requesterMemberId,
      inspectorName: payload.inspectorName,
      inspectorMemberId: payload.inspectorMemberId,
      approverName: payload.approverName,
      approverMemberId: payload.approverMemberId,
      approvalStatus: payload.approvalStatus,
      approvedAt,
      approvalComment: payload.approvalComment,
      inspectionSummary: payload.inspectionSummary,
      linkedProcessInspectionId: referenceInfo.linkedProcessInspectionId,
      linkedProcessInspectionTitle: referenceInfo.linkedProcessInspectionTitle,
      linkedNcrId: referenceInfo.linkedNcrId,
      linkedNcrNo: referenceInfo.linkedNcrNo,
      linkedNcrTitle: referenceInfo.linkedNcrTitle,
      checklistItems: payload.checklistItems,
      attachments,
      history: [
        {
          actionType: "created",
          status: payload.status,
          approvalStatus: payload.approvalStatus,
          note: payload.historyNote || payload.inspectionSummary || payload.approvalComment || "",
          actorName: requester.userName,
          actionDate: new Date(),
        },
      ],
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qc_handover_inspection", String(doc._id), requester, {
      inspectionNo,
      inspectionType: payload.inspectionType,
      status: payload.status,
      approvalStatus: payload.approvalStatus,
      openFindingCount,
    });

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (doc.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );

    return success(serializeItem(doc.toObject() as QcHandoverInspectionLean, fileAssetLinkMap));
  } catch (err) {
    return handleApiError(err);
  }
}

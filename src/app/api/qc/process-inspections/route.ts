import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { getFileAssetLinkMap } from "@/lib/file-asset-links";
import {
  getQcProcessInspectionSort,
  isQcProcessInspectionCorrectiveActionStatus,
  isQcProcessInspectionSort,
  isQcProcessInspectionStatus,
} from "@/lib/qc-process-inspections";
import { normalizeQcProcessInspectionPayload } from "@/lib/qc-process-inspection-payload";
import { resolveQcProcessInspectionItpReference } from "@/lib/qc-process-inspection-record";
import QcProcessInspection from "@/models/QcProcessInspection";

type QcProcessInspectionLean = {
  _id: unknown;
  siteId: unknown;
  workType?: string;
  location?: string;
  processStep?: string;
  inspectionTitle?: string;
  plannedInspectionDate?: Date | null;
  actualInspectionDate?: Date | null;
  status?: string;
  result?: string;
  requesterName?: string;
  requesterMemberId?: string;
  inspectorName?: string;
  inspectorMemberId?: string;
  verifierName?: string;
  verifierMemberId?: string;
  linkedItpPlanId?: mongoose.Types.ObjectId | null;
  linkedItpPlanTitle?: string;
  linkedItpCheckpointId?: string;
  linkedItpCheckpointTitle?: string;
  acceptanceCriteria?: string;
  checklistItems?: Array<{ itemId?: string; label?: string; status?: string; note?: string }>;
  inspectionNotes?: string;
  correctiveActionStatus?: string;
  correctiveActionRequest?: string;
  correctiveActionDueDate?: Date | null;
  correctiveActionSummary?: string;
  attachments?: Array<{ fileAssetId?: mongoose.Types.ObjectId | null; fileName?: string; category?: string; sortOrder?: number }>;
  issueStatus?: string;
  issueReference?: string;
  history?: Array<{ actionType?: string; status?: string; correctiveActionStatus?: string; note?: string; actorName?: string; actionDate?: Date | null }>;
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
  item: QcProcessInspectionLean,
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

function serializeInspection(
  item: QcProcessInspectionLean,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return {
    ...item,
    _id: String(item._id),
    siteId: String(item.siteId ?? ""),
    linkedItpPlanId: item.linkedItpPlanId ? String(item.linkedItpPlanId) : "",
    attachments: mapAttachments(item, fileAssetLinkMap),
    checklistItems: (item.checklistItems ?? []).map((checkItem) => ({
      itemId: checkItem.itemId ?? "",
      label: checkItem.label ?? "",
      status: checkItem.status ?? "pending",
      note: checkItem.note ?? "",
    })),
    history: (item.history ?? []).map((entry) => ({
      actionType: entry.actionType ?? "updated",
      status: entry.status ?? "scheduled",
      correctiveActionStatus: entry.correctiveActionStatus ?? "none",
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
    const limit = parsePositiveInt(searchParams.get("limit"), 20);
    const skip = (page - 1) * limit;
    const keyword = String(searchParams.get("q") ?? "").trim();
    const status = String(searchParams.get("status") ?? "").trim();
    const correctiveActionStatus = String(searchParams.get("correctiveActionStatus") ?? "").trim();
    const onlyOpenActions = String(searchParams.get("onlyOpenActions") ?? "").trim() === "true";
    const sortRaw = String(searchParams.get("sort") ?? "planned_date_desc").trim();
    const filter: Record<string, unknown> = { siteId };

    if (status) {
      if (!isQcProcessInspectionStatus(status)) {
        throw VALIDATION_ERROR("공정 검사 상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }

    if (correctiveActionStatus) {
      if (!isQcProcessInspectionCorrectiveActionStatus(correctiveActionStatus)) {
        throw VALIDATION_ERROR("시정조치 상태 필터 값이 올바르지 않습니다.");
      }
      filter.correctiveActionStatus = correctiveActionStatus;
    }

    if (onlyOpenActions) {
      filter.correctiveActionStatus = { $in: ["requested", "in_progress"] };
    }

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { workType: regex },
        { location: regex },
        { processStep: regex },
        { inspectionTitle: regex },
        { requesterName: regex },
        { inspectorName: regex },
        { verifierName: regex },
        { linkedItpPlanTitle: regex },
        { linkedItpCheckpointTitle: regex },
        { inspectionNotes: regex },
        { correctiveActionRequest: regex },
        { correctiveActionSummary: regex },
        { issueReference: regex },
      ];
    }

    const sort = isQcProcessInspectionSort(sortRaw) ? sortRaw : "planned_date_desc";

    const [data, total] = await Promise.all([
      QcProcessInspection.find(filter)
        .sort(getQcProcessInspectionSort(sort))
        .skip(skip)
        .limit(limit)
        .lean<Array<QcProcessInspectionLean>>(),
      QcProcessInspection.countDocuments(filter),
    ]);

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      data.flatMap((item) => (item.attachments ?? []).map((attachment) => attachment.fileAssetId)),
    );

    return paginated(
      data.map((item) => serializeInspection(item, fileAssetLinkMap)),
      page,
      limit,
      total,
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

    const payload = normalizeQcProcessInspectionPayload(body);
    const itpReference = await resolveQcProcessInspectionItpReference(siteId, payload);
    const attachments = payload.attachments.map((attachment) => ({
      fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
      fileName: attachment.fileName,
      category: attachment.category,
      sortOrder: attachment.sortOrder,
    }));
    const correctiveActionStatus =
      payload.correctiveActionStatus === "none" && payload.result === "fail"
        ? "requested"
        : payload.correctiveActionStatus;
    const issueStatus =
      payload.issueStatus === "none" && payload.result === "fail" ? "recommended" : payload.issueStatus;

    const doc = await QcProcessInspection.create({
      siteId,
      workType: payload.workType,
      location: payload.location,
      processStep: payload.processStep,
      inspectionTitle: payload.inspectionTitle,
      plannedInspectionDate: payload.plannedInspectionDate ?? new Date(),
      actualInspectionDate: payload.actualInspectionDate ?? undefined,
      status: payload.status,
      result: payload.result,
      requesterName: payload.requesterName || requester.userName,
      requesterMemberId: payload.requesterMemberId,
      inspectorName: payload.inspectorName,
      inspectorMemberId: payload.inspectorMemberId,
      verifierName: payload.verifierName,
      verifierMemberId: payload.verifierMemberId,
      linkedItpPlanId: itpReference.linkedItpPlanId,
      linkedItpPlanTitle: itpReference.linkedItpPlanTitle,
      linkedItpCheckpointId: itpReference.linkedItpCheckpointId,
      linkedItpCheckpointTitle: itpReference.linkedItpCheckpointTitle,
      acceptanceCriteria: itpReference.acceptanceCriteria,
      checklistItems: payload.checklistItems,
      inspectionNotes: payload.inspectionNotes,
      correctiveActionStatus,
      correctiveActionRequest: payload.correctiveActionRequest,
      correctiveActionDueDate: payload.correctiveActionDueDate ?? undefined,
      correctiveActionSummary: payload.correctiveActionSummary,
      attachments,
      issueStatus,
      issueReference: payload.issueReference,
      history: [
        {
          actionType: "created",
          status: payload.status,
          correctiveActionStatus,
          note: payload.historyNote || payload.inspectionNotes || payload.correctiveActionRequest,
          actorName: requester.userName,
          actionDate: new Date(),
        },
      ],
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qc_process_inspection", String(doc._id), requester, {
      status: payload.status,
      result: payload.result,
      correctiveActionStatus,
      issueStatus,
      attachmentCount: attachments.length,
    });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

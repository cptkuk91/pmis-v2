import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { getFileAssetLinkMap } from "@/lib/file-asset-links";
import { normalizeQcHandoverInspectionPayload } from "@/lib/qc-handover-inspection-payload";
import {
  assertValidQcHandoverLifecycle,
  inferQcHandoverHistoryAction,
  resolveQcHandoverInspectionReferences,
} from "@/lib/qc-handover-inspection-record";
import { getQcHandoverOpenFindingCount, getQcHandoverResult } from "@/lib/qc-handover-inspections";
import QcHandoverInspection from "@/models/QcHandoverInspection";

type Params = {
  params: Promise<{ inspectionId: string }>;
};

async function findItem(siteId: string, inspectionId: string) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw VALIDATION_ERROR("inspectionId 형식이 올바르지 않습니다.");
  }

  const item = await QcHandoverInspection.findOne({ _id: inspectionId, siteId });
  if (!item) {
    throw NOT_FOUND("인수·준공 검사");
  }
  return item;
}

function mapAttachments(
  item: Awaited<ReturnType<typeof findItem>>,
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
  item: Awaited<ReturnType<typeof findItem>>,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return {
    ...item.toObject(),
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

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { inspectionId } = await params;
    const item = await findItem(siteId, inspectionId);
    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );
    return success(serializeItem(item, fileAssetLinkMap));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { inspectionId } = await params;
    const item = await findItem(siteId, inspectionId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQcHandoverInspectionPayload(body, { partial: true });
    const previousState = {
      status: item.status,
      approvalStatus: item.approvalStatus,
      openFindingCount: item.openFindingCount,
    } as const;

    const nextReferenceInput = {
      linkedProcessInspectionId:
        payload.linkedProcessInspectionId ?? (item.linkedProcessInspectionId ? String(item.linkedProcessInspectionId) : ""),
      linkedNcrId: payload.linkedNcrId ?? (item.linkedNcrId ? String(item.linkedNcrId) : ""),
    } as const;

    const referenceInfo =
      payload.linkedProcessInspectionId !== undefined || payload.linkedNcrId !== undefined
        ? await resolveQcHandoverInspectionReferences(siteId, nextReferenceInput)
        : null;

    if (payload.inspectionType !== undefined) item.inspectionType = payload.inspectionType;
    if (payload.inspectionTitle !== undefined) item.inspectionTitle = payload.inspectionTitle;
    if (payload.workType !== undefined) item.workType = payload.workType;
    if (payload.areaType !== undefined) item.areaType = payload.areaType;
    if (payload.areaLabel !== undefined) item.areaLabel = payload.areaLabel;
    if (payload.unitNo !== undefined) item.unitNo = payload.unitNo;
    if (payload.zoneName !== undefined) item.zoneName = payload.zoneName;
    if (payload.plannedInspectionDate !== undefined) {
      item.plannedInspectionDate = payload.plannedInspectionDate ?? item.plannedInspectionDate;
    }
    if (payload.inspectedAt !== undefined) item.inspectedAt = payload.inspectedAt;
    if (payload.status !== undefined) item.status = payload.status;
    if (payload.requesterName !== undefined) item.requesterName = payload.requesterName;
    if (payload.requesterMemberId !== undefined) item.requesterMemberId = payload.requesterMemberId;
    if (payload.inspectorName !== undefined) item.inspectorName = payload.inspectorName;
    if (payload.inspectorMemberId !== undefined) item.inspectorMemberId = payload.inspectorMemberId;
    if (payload.approverName !== undefined) item.approverName = payload.approverName;
    if (payload.approverMemberId !== undefined) item.approverMemberId = payload.approverMemberId;
    if (payload.approvalStatus !== undefined) item.approvalStatus = payload.approvalStatus;
    if (payload.approvalComment !== undefined) item.approvalComment = payload.approvalComment;
    if (payload.inspectionSummary !== undefined) item.inspectionSummary = payload.inspectionSummary;
    if (referenceInfo) {
      item.linkedProcessInspectionId = referenceInfo.linkedProcessInspectionId;
      item.linkedProcessInspectionTitle = referenceInfo.linkedProcessInspectionTitle;
      item.linkedNcrId = referenceInfo.linkedNcrId;
      item.linkedNcrNo = referenceInfo.linkedNcrNo;
      item.linkedNcrTitle = referenceInfo.linkedNcrTitle;
    }
    if (payload.checklistItems !== undefined) {
      item.checklistItems = payload.checklistItems;
    }
    if (payload.attachments !== undefined) {
      item.attachments = payload.attachments.map((attachment) => ({
        fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
        fileName: attachment.fileName,
        category: attachment.category,
        sortOrder: attachment.sortOrder,
      }));
    }

    item.result = getQcHandoverResult(item.checklistItems);
    item.openFindingCount = getQcHandoverOpenFindingCount(item.checklistItems);
    if (payload.approvedAt !== undefined) {
      item.approvedAt = payload.approvedAt;
    }
    if (item.approvalStatus === "approved") {
      item.approvedAt = item.approvedAt ?? new Date();
    } else if (payload.approvalStatus !== undefined && payload.approvalStatus !== "approved") {
      item.approvedAt = null;
    }

    assertValidQcHandoverLifecycle({
      status: item.status,
      approvalStatus: item.approvalStatus,
      openFindingCount: item.openFindingCount,
      approvedAt: item.approvedAt,
    });

    const nextState = {
      status: item.status,
      approvalStatus: item.approvalStatus,
      openFindingCount: item.openFindingCount,
    } as const;

    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    item.history.push({
      actionType: inferQcHandoverHistoryAction(previousState, nextState),
      status: item.status,
      approvalStatus: item.approvalStatus,
      note: payload.historyNote || payload.inspectionSummary || payload.approvalComment || "",
      actorName: requester.userName,
      actionDate: new Date(),
    });

    await item.save();

    logUpdate(siteId, "qc_handover_inspection", inspectionId, requester, {
      updatedFields: Object.keys(body),
      inspectionNo: item.inspectionNo,
      status: item.status,
      approvalStatus: item.approvalStatus,
      result: item.result,
      openFindingCount: item.openFindingCount,
    });

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );

    return success(serializeItem(item, fileAssetLinkMap));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { inspectionId } = await params;
    const item = await findItem(siteId, inspectionId);

    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.softDelete();
    logDelete(siteId, "qc_handover_inspection", inspectionId, requester);
    return success({ id: inspectionId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

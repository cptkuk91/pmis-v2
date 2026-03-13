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
import { normalizeQcProcessInspectionPayload } from "@/lib/qc-process-inspection-payload";
import {
  inferQcProcessInspectionHistoryAction,
  resolveQcProcessInspectionItpReference,
} from "@/lib/qc-process-inspection-record";
import QcProcessInspection from "@/models/QcProcessInspection";

type Params = {
  params: Promise<{ inspectionId: string }>;
};

async function findInspection(siteId: string, inspectionId: string) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw VALIDATION_ERROR("inspectionId 형식이 올바르지 않습니다.");
  }

  const item = await QcProcessInspection.findOne({ _id: inspectionId, siteId });
  if (!item) {
    throw NOT_FOUND("공정 검사");
  }
  return item;
}

function mapAttachments(
  item: Awaited<ReturnType<typeof findInspection>>,
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
  item: Awaited<ReturnType<typeof findInspection>>,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return {
    ...item.toObject(),
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

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { inspectionId } = await params;
    const item = await findInspection(siteId, inspectionId);
    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );

    return success(serializeInspection(item, fileAssetLinkMap));
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
    const item = await findInspection(siteId, inspectionId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQcProcessInspectionPayload(body, { partial: true });
    const previousState = {
      status: item.status,
      correctiveActionStatus: item.correctiveActionStatus,
    } as const;

    if (payload.workType !== undefined) item.workType = payload.workType;
    if (payload.location !== undefined) item.location = payload.location;
    if (payload.processStep !== undefined) item.processStep = payload.processStep;
    if (payload.inspectionTitle !== undefined) item.inspectionTitle = payload.inspectionTitle;
    if (payload.plannedInspectionDate !== undefined) {
      item.plannedInspectionDate = payload.plannedInspectionDate ?? item.plannedInspectionDate;
    }
    if (payload.actualInspectionDate !== undefined) item.actualInspectionDate = payload.actualInspectionDate ?? undefined;
    if (payload.status !== undefined) item.status = payload.status;
    if (payload.result !== undefined) item.result = payload.result;
    if (payload.requesterName !== undefined) item.requesterName = payload.requesterName;
    if (payload.requesterMemberId !== undefined) item.requesterMemberId = payload.requesterMemberId;
    if (payload.inspectorName !== undefined) item.inspectorName = payload.inspectorName;
    if (payload.inspectorMemberId !== undefined) item.inspectorMemberId = payload.inspectorMemberId;
    if (payload.verifierName !== undefined) item.verifierName = payload.verifierName;
    if (payload.verifierMemberId !== undefined) item.verifierMemberId = payload.verifierMemberId;

    if (
      payload.linkedItpPlanId !== undefined ||
      payload.linkedItpCheckpointId !== undefined ||
      payload.acceptanceCriteria !== undefined
    ) {
      const itpReference = await resolveQcProcessInspectionItpReference(siteId, {
        linkedItpPlanId: payload.linkedItpPlanId ?? (item.linkedItpPlanId ? String(item.linkedItpPlanId) : ""),
        linkedItpCheckpointId: payload.linkedItpCheckpointId ?? item.linkedItpCheckpointId ?? "",
        acceptanceCriteria: payload.acceptanceCriteria ?? item.acceptanceCriteria ?? "",
      });

      item.linkedItpPlanId = itpReference.linkedItpPlanId;
      item.linkedItpPlanTitle = itpReference.linkedItpPlanTitle;
      item.linkedItpCheckpointId = itpReference.linkedItpCheckpointId;
      item.linkedItpCheckpointTitle = itpReference.linkedItpCheckpointTitle;
      item.acceptanceCriteria = itpReference.acceptanceCriteria;
    }

    if (payload.checklistItems !== undefined) item.checklistItems = payload.checklistItems;
    if (payload.inspectionNotes !== undefined) item.inspectionNotes = payload.inspectionNotes;
    if (payload.correctiveActionStatus !== undefined) item.correctiveActionStatus = payload.correctiveActionStatus;
    if (payload.correctiveActionRequest !== undefined) item.correctiveActionRequest = payload.correctiveActionRequest;
    if (payload.correctiveActionDueDate !== undefined) item.correctiveActionDueDate = payload.correctiveActionDueDate ?? undefined;
    if (payload.correctiveActionSummary !== undefined) item.correctiveActionSummary = payload.correctiveActionSummary;
    if (payload.attachments !== undefined) {
      item.attachments = payload.attachments.map((attachment) => ({
        fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
        fileName: attachment.fileName,
        category: attachment.category,
        sortOrder: attachment.sortOrder,
      }));
    }
    if (payload.issueStatus !== undefined) item.issueStatus = payload.issueStatus;
    if (payload.issueReference !== undefined) item.issueReference = payload.issueReference;

    if (item.result === "fail" && item.correctiveActionStatus === "none") {
      item.correctiveActionStatus = "requested";
    }
    if (item.result === "fail" && item.issueStatus === "none") {
      item.issueStatus = "recommended";
    }

    const nextState = {
      status: item.status,
      correctiveActionStatus: item.correctiveActionStatus,
    } as const;
    item.history.push({
      actionType: inferQcProcessInspectionHistoryAction(previousState, nextState),
      status: item.status,
      correctiveActionStatus: item.correctiveActionStatus,
      note: payload.historyNote || payload.inspectionNotes || payload.correctiveActionRequest || payload.correctiveActionSummary || "",
      actorName: requester.userName,
      actionDate: new Date(),
    });

    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.save();

    logUpdate(siteId, "qc_process_inspection", inspectionId, requester, {
      updatedFields: Object.keys(body),
      status: item.status,
      result: item.result,
      correctiveActionStatus: item.correctiveActionStatus,
      issueStatus: item.issueStatus,
    });

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );
    return success(serializeInspection(item, fileAssetLinkMap));
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
    const item = await findInspection(siteId, inspectionId);
    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.softDelete();

    logDelete(siteId, "qc_process_inspection", inspectionId, requester);
    return success({ id: inspectionId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

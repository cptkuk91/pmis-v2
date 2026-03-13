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
import { normalizeQcNonconformancePayload } from "@/lib/qc-nonconformance-payload";
import {
  inferQcNonconformanceHistoryAction,
  resolveQcNonconformanceReferences,
  syncQcNonconformanceLinks,
  validateQcNonconformanceLifecycle,
  type QcNonconformanceReferenceSnapshot,
} from "@/lib/qc-nonconformance-record";
import QcNonconformance from "@/models/QcNonconformance";

type Params = {
  params: Promise<{ ncrId: string }>;
};

async function findItem(siteId: string, ncrId: string) {
  if (!mongoose.Types.ObjectId.isValid(ncrId)) {
    throw VALIDATION_ERROR("ncrId 형식이 올바르지 않습니다.");
  }

  const item = await QcNonconformance.findOne({ _id: ncrId, siteId });
  if (!item) {
    throw NOT_FOUND("NCR");
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

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { ncrId } = await params;
    const item = await findItem(siteId, ncrId);
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

    const { ncrId } = await params;
    const item = await findItem(siteId, ncrId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQcNonconformancePayload(body, { partial: true });
    const reminderRequested = Boolean(payload.reminderRequested);
    const previousState = {
      status: item.status,
      verificationResult: item.verificationResult,
    } as const;
    const currentReferences = buildReferenceSnapshot(item);

    const nextSourceType = payload.sourceType ?? item.sourceType;
    const nextReferenceInput = {
      sourceType: nextSourceType,
      linkedMaterialInspectionId: payload.linkedMaterialInspectionId ?? currentReferences.linkedMaterialInspectionId,
      linkedProcessInspectionId: payload.linkedProcessInspectionId ?? currentReferences.linkedProcessInspectionId,
      linkedTestReportId: payload.linkedTestReportId ?? currentReferences.linkedTestReportId,
      sourceSummary: payload.sourceSummary ?? item.sourceSummary,
    } as const;

    const referenceInfo =
      payload.sourceType !== undefined ||
      payload.linkedMaterialInspectionId !== undefined ||
      payload.linkedProcessInspectionId !== undefined ||
      payload.linkedTestReportId !== undefined ||
      payload.sourceSummary !== undefined
        ? await resolveQcNonconformanceReferences(siteId, nextReferenceInput, ncrId)
        : null;

    if (payload.occurrenceType !== undefined) item.occurrenceType = payload.occurrenceType;
    if (payload.sourceType !== undefined) item.sourceType = payload.sourceType;
    if (payload.severity !== undefined) item.severity = payload.severity;
    if (payload.severityRank !== undefined) item.severityRank = payload.severityRank;
    if (payload.title !== undefined) item.title = payload.title;
    if (payload.description !== undefined) item.description = payload.description;
    if (payload.occurrenceDate !== undefined) item.occurrenceDate = payload.occurrenceDate ?? item.occurrenceDate;
    if (payload.location !== undefined) item.location = payload.location;
    if (payload.workType !== undefined) item.workType = payload.workType;
    if (referenceInfo) {
      item.linkedMaterialInspectionId = referenceInfo.linkedMaterialInspectionId;
      item.linkedMaterialInspectionTitle = referenceInfo.linkedMaterialInspectionTitle;
      item.linkedProcessInspectionId = referenceInfo.linkedProcessInspectionId;
      item.linkedProcessInspectionTitle = referenceInfo.linkedProcessInspectionTitle;
      item.linkedTestReportId = referenceInfo.linkedTestReportId;
      item.linkedTestReportTitle = referenceInfo.linkedTestReportTitle;
      item.sourceSummary = referenceInfo.sourceSummary;
    } else if (payload.sourceSummary !== undefined) {
      item.sourceSummary = payload.sourceSummary;
    }
    if (payload.assigneeName !== undefined) item.assigneeName = payload.assigneeName;
    if (payload.assigneeMemberId !== undefined) item.assigneeMemberId = payload.assigneeMemberId;
    if (payload.verifierName !== undefined) item.verifierName = payload.verifierName;
    if (payload.verifierMemberId !== undefined) item.verifierMemberId = payload.verifierMemberId;
    if (payload.dueDate !== undefined) item.dueDate = payload.dueDate ?? item.dueDate;
    if (payload.status !== undefined) item.status = payload.status;
    if (payload.rootCauseSummary !== undefined) item.rootCauseSummary = payload.rootCauseSummary;
    if (payload.containmentAction !== undefined) item.containmentAction = payload.containmentAction;
    if (payload.correctiveActionPlan !== undefined) item.correctiveActionPlan = payload.correctiveActionPlan;
    if (payload.preventiveAction !== undefined) item.preventiveAction = payload.preventiveAction;
    if (payload.actionTaken !== undefined) item.actionTaken = payload.actionTaken;
    if (payload.verificationResult !== undefined) item.verificationResult = payload.verificationResult;
    if (payload.verificationNote !== undefined) item.verificationNote = payload.verificationNote;
    if (payload.verifiedAt !== undefined) item.verifiedAt = payload.verifiedAt;
    if (payload.attachments !== undefined) {
      item.attachments = payload.attachments.map((attachment) => ({
        fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
        fileName: attachment.fileName,
        category: attachment.category,
        sortOrder: attachment.sortOrder,
      }));
    }

    validateQcNonconformanceLifecycle({
      status: item.status,
      verificationResult: item.verificationResult,
      verifiedAt: item.verifiedAt,
    });

    item.closedAt = item.status === "closed" ? item.verifiedAt ?? item.closedAt ?? new Date() : null;
    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    const nextState = {
      status: item.status,
      verificationResult: item.verificationResult,
    } as const;
    item.history.push({
      actionType: inferQcNonconformanceHistoryAction(previousState, nextState, reminderRequested),
      status: item.status,
      verificationResult: item.verificationResult,
      note:
        payload.historyNote ||
        (reminderRequested ? "기한 경과 NCR 리마인드 기록" : payload.verificationNote || payload.actionTaken || ""),
      actorName: requester.userName,
      actionDate: new Date(),
    });

    await item.save();

    await syncQcNonconformanceLinks(siteId, currentReferences, buildReferenceSnapshot(item), item.ncrNo);

    logUpdate(siteId, "qc_nonconformance", ncrId, requester, {
      updatedFields: Object.keys(body),
      ncrNo: item.ncrNo,
      status: item.status,
      severity: item.severity,
      verificationResult: item.verificationResult,
      overdue: item.status !== "closed" && item.dueDate ? item.dueDate.getTime() < Date.now() : false,
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

    const { ncrId } = await params;
    const item = await findItem(siteId, ncrId);
    const currentReferences = buildReferenceSnapshot(item);

    await syncQcNonconformanceLinks(
      siteId,
      currentReferences,
      { linkedMaterialInspectionId: "", linkedProcessInspectionId: "", linkedTestReportId: "" },
      item.ncrNo,
    );

    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.softDelete();
    logDelete(siteId, "qc_nonconformance", ncrId, requester);
    return success({ id: ncrId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

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
import MaterialInspection from "@/models/MaterialInspection";
import { normalizeQcMaterialInspectionPayload } from "@/lib/qc-material-inspection-payload";
import {
  inferQcMaterialInspectionHistoryAction,
  resolveQcMaterialInspectionItpReference,
} from "@/lib/qc-material-inspection-record";

type Params = {
  params: Promise<{ inspectionId: string }>;
};

function mapInspectionAttachments(
  item: Awaited<ReturnType<typeof findInspection>>,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  const attachments = (item.attachments ?? [])
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

  if (attachments.length > 0) {
    return attachments;
  }

  const legacyFileAssetId = String(item.fileAssetId ?? "").trim();
  if (!legacyFileAssetId) {
    return [];
  }

  const fileLink = fileAssetLinkMap.get(legacyFileAssetId);
  return [
    {
      fileAssetId: legacyFileAssetId,
      fileName: fileLink?.originalName ?? legacyFileAssetId,
      fileUrl: fileLink?.url ?? "",
      category: "other",
      sortOrder: 0,
    },
  ];
}

function serializeInspection(
  item: Awaited<ReturnType<typeof findInspection>>,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  const attachments = mapInspectionAttachments(item, fileAssetLinkMap);
  const primaryAttachment = attachments[0];

  return {
    ...item.toObject(),
    _id: String(item._id),
    siteId: String(item.siteId ?? ""),
    linkedItpPlanId: item.linkedItpPlanId ? String(item.linkedItpPlanId) : "",
    attachments,
    fileAssetId: primaryAttachment?.fileAssetId ?? (item.fileAssetId ? String(item.fileAssetId) : null),
    fileName: primaryAttachment?.fileName ?? "",
    fileUrl: primaryAttachment?.fileUrl ?? "",
    checklistItems: (item.checklistItems ?? []).map((checklist) => ({
      itemId: checklist.itemId ?? "",
      label: checklist.label ?? "",
      status: checklist.status ?? "pending",
      note: checklist.note ?? "",
    })),
    history: (item.history ?? []).map((entry) => ({
      actionType: entry.actionType ?? "updated",
      result: entry.result ?? "pending",
      disposition: entry.disposition ?? "none",
      note: entry.note ?? "",
      actorName: entry.actorName ?? "",
      actionDate: entry.actionDate ? new Date(entry.actionDate).toISOString() : new Date(0).toISOString(),
    })),
  };
}

async function findInspection(siteId: string, inspectionId: string) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw VALIDATION_ERROR("inspectionId 형식이 올바르지 않습니다.");
  }

  const item = await MaterialInspection.findOne({ _id: inspectionId, siteId });
  if (!item) {
    throw NOT_FOUND("자재 검사");
  }
  return item;
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
    const fileAssetLinkMap = await getFileAssetLinkMap(siteId, [
      item.fileAssetId,
      ...(item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    ]);

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
    const payload = normalizeQcMaterialInspectionPayload(body, { partial: true });
    const previousState = {
      result: item.result,
      disposition: item.disposition,
    } as const;

    if (payload.materialCategory !== undefined) {
      item.materialCategory = payload.materialCategory;
    }
    if (payload.materialName !== undefined) {
      item.materialName = payload.materialName;
    }
    if (payload.specification !== undefined) {
      item.specification = payload.specification;
    }
    if (payload.supplier !== undefined) {
      item.supplier = payload.supplier;
    }
    if (payload.lotNo !== undefined) {
      item.lotNo = payload.lotNo;
    }
    if (payload.inboundDate !== undefined) {
      item.inboundDate = payload.inboundDate ?? undefined;
    }
    if (payload.quantity !== undefined) {
      item.quantity = payload.quantity;
    }
    if (payload.unit !== undefined) {
      item.unit = payload.unit;
    }
    if (payload.inspectionDate !== undefined) {
      item.inspectionDate = payload.inspectionDate ?? item.inspectionDate;
    }
    if (payload.result !== undefined) {
      item.result = payload.result;
    }
    if (payload.disposition !== undefined) {
      item.disposition = payload.disposition;
    }
    if (payload.inspector !== undefined) {
      item.inspector = payload.inspector;
    }

    if (
      payload.linkedItpPlanId !== undefined ||
      payload.linkedItpCheckpointId !== undefined ||
      payload.inspectionStandard !== undefined
    ) {
      const itpReference = await resolveQcMaterialInspectionItpReference(siteId, {
        linkedItpPlanId: payload.linkedItpPlanId ?? (item.linkedItpPlanId ? String(item.linkedItpPlanId) : ""),
        linkedItpCheckpointId: payload.linkedItpCheckpointId ?? item.linkedItpCheckpointId ?? "",
        inspectionStandard: payload.inspectionStandard ?? item.inspectionStandard ?? "",
      });

      item.linkedItpPlanId = itpReference.linkedItpPlanId;
      item.linkedItpPlanTitle = itpReference.linkedItpPlanTitle;
      item.linkedItpCheckpointId = itpReference.linkedItpCheckpointId;
      item.linkedItpCheckpointTitle = itpReference.linkedItpCheckpointTitle;
      item.inspectionStandard = itpReference.inspectionStandard;
    }

    if (payload.checklistItems !== undefined) {
      item.checklistItems = payload.checklistItems;
    }
    if (payload.decisionReason !== undefined) {
      item.decisionReason = payload.decisionReason;
    }
    if (payload.remarks !== undefined) {
      item.remarks = payload.remarks;
    }
    if (payload.attachments !== undefined) {
      item.attachments = payload.attachments.map((attachment) => ({
        fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
        fileName: attachment.fileName,
        category: attachment.category,
        sortOrder: attachment.sortOrder,
      }));
      item.fileAssetId = item.attachments[0]?.fileAssetId;
    }
    if (payload.ncrStatus !== undefined) {
      item.ncrStatus = payload.ncrStatus;
    }
    if (payload.ncrReference !== undefined) {
      item.ncrReference = payload.ncrReference;
    }

    if (item.result === "fail" && item.ncrStatus === "none") {
      item.ncrStatus = "recommended";
    }

    const nextState = {
      result: item.result,
      disposition: item.disposition,
    } as const;
    const changedFields = Object.keys(body);
    const shouldAddHistory =
      changedFields.length > 0 ||
      previousState.result !== nextState.result ||
      previousState.disposition !== nextState.disposition ||
      Boolean(payload.historyNote);

    if (shouldAddHistory) {
      item.history.push({
        actionType: inferQcMaterialInspectionHistoryAction(previousState, nextState),
        result: nextState.result,
        disposition: nextState.disposition,
        note: payload.historyNote || payload.decisionReason || payload.remarks || "",
        actorName: requester.userName,
        actionDate: new Date(),
      });
    }

    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.save();

    logUpdate(siteId, "material_inspection", inspectionId, requester, {
      updatedFields: changedFields,
      result: item.result,
      disposition: item.disposition,
      ncrStatus: item.ncrStatus,
    });

    const fileAssetLinkMap = await getFileAssetLinkMap(siteId, [
      item.fileAssetId,
      ...(item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    ]);

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

    logDelete(siteId, "material_inspection", inspectionId, requester);
    return success({ id: inspectionId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

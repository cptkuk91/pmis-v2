import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import MaterialInspection from "@/models/MaterialInspection";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { getFileAssetLinkMap } from "@/lib/file-asset-links";
import { normalizeQcMaterialInspectionPayload } from "@/lib/qc-material-inspection-payload";
import { resolveQcMaterialInspectionItpReference } from "@/lib/qc-material-inspection-record";
import {
  getQcMaterialInspectionSort,
  isQcMaterialInspectionResult,
  isQcMaterialInspectionSort,
} from "@/lib/qc-material-inspections";

type MaterialInspectionLean = {
  _id: unknown;
  siteId: unknown;
  materialCategory?: string;
  materialName?: string;
  specification?: string;
  supplier?: string;
  lotNo?: string;
  inboundDate?: Date | null;
  quantity?: number;
  unit?: string;
  inspectionDate?: Date | null;
  result?: string;
  disposition?: string;
  inspector?: string;
  linkedItpPlanId?: mongoose.Types.ObjectId | null;
  linkedItpPlanTitle?: string;
  linkedItpCheckpointId?: string;
  linkedItpCheckpointTitle?: string;
  inspectionStandard?: string;
  checklistItems?: Array<{ itemId?: string; label?: string; status?: string; note?: string }>;
  decisionReason?: string;
  remarks?: string;
  attachments?: Array<{
    fileAssetId?: mongoose.Types.ObjectId | null;
    fileName?: string;
    category?: string;
    sortOrder?: number;
  }>;
  fileAssetId?: mongoose.Types.ObjectId | null;
  ncrStatus?: string;
  ncrReference?: string;
  history?: Array<{
    actionType?: string;
    result?: string;
    disposition?: string;
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

function collectAttachmentIds(item: MaterialInspectionLean) {
  const attachmentIds = (item.attachments ?? []).map((attachment) => attachment.fileAssetId);
  return [...attachmentIds, item.fileAssetId];
}

function mapInspectionAttachments(item: MaterialInspectionLean, fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>) {
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

function serializeInspection(item: MaterialInspectionLean, fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>) {
  const attachments = mapInspectionAttachments(item, fileAssetLinkMap);
  const primaryAttachment = attachments[0];

  return {
    ...item,
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

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();
    const { searchParams } = request.nextUrl;
    const querySiteId = searchParams.get("siteId");
    const siteId = querySiteId || (await resolveSiteId(request));
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 20);
    const skip = (page - 1) * limit;

    const result = String(searchParams.get("result") ?? "").trim();
    const keyword = String(searchParams.get("q") ?? "").trim();
    const sortRaw = String(searchParams.get("sort") ?? "inspection_date_desc").trim();
    const filter: Record<string, unknown> = { siteId };

    if (result) {
      if (!isQcMaterialInspectionResult(result)) {
        throw VALIDATION_ERROR("자재 검사 결과 필터 값이 올바르지 않습니다.");
      }
      filter.result = result;
    }

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { materialName: regex },
        { specification: regex },
        { supplier: regex },
        { materialCategory: regex },
        { lotNo: regex },
        { inspector: regex },
        { decisionReason: regex },
        { remarks: regex },
        { linkedItpPlanTitle: regex },
        { linkedItpCheckpointTitle: regex },
        { ncrReference: regex },
      ];
    }

    const sort = isQcMaterialInspectionSort(sortRaw) ? sortRaw : "inspection_date_desc";

    const [data, total] = await Promise.all([
      MaterialInspection.find(filter)
        .sort(getQcMaterialInspectionSort(sort))
        .skip(skip)
        .limit(limit)
        .lean<Array<MaterialInspectionLean>>(),
      MaterialInspection.countDocuments(filter),
    ]);

    const fileAssetLinkMap = await getFileAssetLinkMap(
      String(siteId),
      data.flatMap((item) => collectAttachmentIds(item)),
    );
    const items = data.map((item) => serializeInspection(item, fileAssetLinkMap));

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

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = (await resolveSiteId(request)) || String(body.siteId ?? "");
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const payload = normalizeQcMaterialInspectionPayload(body);
    const itpReference = await resolveQcMaterialInspectionItpReference(siteId, payload);
    const attachments = payload.attachments.map((attachment) => ({
      fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
      fileName: attachment.fileName,
      category: attachment.category,
      sortOrder: attachment.sortOrder,
    }));
    const initialNote = payload.historyNote || payload.decisionReason || payload.remarks;
    const ncrStatus = payload.ncrStatus === "none" && payload.result === "fail" ? "recommended" : payload.ncrStatus;

    const doc = await MaterialInspection.create({
      siteId,
      materialCategory: payload.materialCategory,
      materialName: payload.materialName,
      specification: payload.specification,
      supplier: payload.supplier,
      lotNo: payload.lotNo,
      inboundDate: payload.inboundDate ?? undefined,
      quantity: payload.quantity,
      unit: payload.unit,
      inspectionDate: payload.inspectionDate ?? new Date(),
      result: payload.result,
      disposition: payload.disposition,
      inspector: payload.inspector || requester.userName,
      linkedItpPlanId: itpReference.linkedItpPlanId,
      linkedItpPlanTitle: itpReference.linkedItpPlanTitle,
      linkedItpCheckpointId: itpReference.linkedItpCheckpointId,
      linkedItpCheckpointTitle: itpReference.linkedItpCheckpointTitle,
      inspectionStandard: itpReference.inspectionStandard,
      checklistItems: payload.checklistItems,
      decisionReason: payload.decisionReason,
      remarks: payload.remarks,
      attachments,
      fileAssetId: attachments[0]?.fileAssetId,
      ncrStatus,
      ncrReference: payload.ncrReference,
      history: [
        {
          actionType: "created",
          result: payload.result,
          disposition: payload.disposition,
          note: initialNote,
          actorName: requester.userName,
          actionDate: new Date(),
        },
      ],
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(String(siteId), "material_inspection", String(doc._id), requester, {
      result: payload.result,
      disposition: payload.disposition,
      attachmentCount: attachments.length,
      linkedItpPlanId: itpReference.linkedItpPlanId ? String(itpReference.linkedItpPlanId) : "",
      ncrStatus,
    });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

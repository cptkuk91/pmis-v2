import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { isQcAttachmentCategory, type QcAttachmentCategory } from "@/lib/qc-core";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QC_MATERIAL_CATEGORY_VALUES,
  QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES,
  QC_MATERIAL_INSPECTION_DISPOSITION_VALUES,
  QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES,
  QC_MATERIAL_INSPECTION_RESULT_VALUES,
  isQcMaterialCategory,
  isQcMaterialInspectionCheckStatus,
  isQcMaterialInspectionDisposition,
  isQcMaterialInspectionNcrStatus,
  isQcMaterialInspectionResult,
  type QcMaterialCategory,
  type QcMaterialInspectionCheckStatus,
  type QcMaterialInspectionDisposition,
  type QcMaterialInspectionNcrStatus,
  type QcMaterialInspectionResult,
} from "@/lib/qc-material-inspections";

export type QcMaterialInspectionAttachmentPayload = {
  fileAssetId: string;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcMaterialInspectionChecklistItemPayload = {
  itemId: string;
  label: string;
  status: QcMaterialInspectionCheckStatus;
  note: string;
};

export type QcMaterialInspectionPayload = {
  materialCategory: QcMaterialCategory;
  materialName: string;
  specification: string;
  supplier: string;
  lotNo: string;
  inboundDate: Date | null;
  quantity: number;
  unit: string;
  inspectionDate: Date | null;
  result: QcMaterialInspectionResult;
  disposition: QcMaterialInspectionDisposition;
  inspector: string;
  linkedItpPlanId: string;
  linkedItpCheckpointId: string;
  inspectionStandard: string;
  checklistItems: QcMaterialInspectionChecklistItemPayload[];
  decisionReason: string;
  remarks: string;
  attachments: QcMaterialInspectionAttachmentPayload[];
  ncrStatus: QcMaterialInspectionNcrStatus;
  ncrReference: string;
  historyNote: string;
};

type NormalizeOptions = {
  partial?: boolean;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDate(value: unknown, fieldLabel: string): Date | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

function parseQuantity(value: unknown, fieldLabel: string, fallback = 0): number {
  const raw = normalizeText(value);
  if (!raw) {
    return fallback;
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw VALIDATION_ERROR(`${fieldLabel}은(는) 0 이상의 숫자여야 합니다.`);
  }
  return numeric;
}

function parseMaterialCategory(value: unknown): QcMaterialCategory {
  const raw = normalizeText(value) || "other";
  if (!isQcMaterialCategory(raw)) {
    throw VALIDATION_ERROR(`자재 분류는 ${QC_MATERIAL_CATEGORY_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseResult(value: unknown): QcMaterialInspectionResult {
  const raw = normalizeText(value) || "pending";
  if (!isQcMaterialInspectionResult(raw)) {
    throw VALIDATION_ERROR(`검수 결과는 ${QC_MATERIAL_INSPECTION_RESULT_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseDisposition(value: unknown): QcMaterialInspectionDisposition {
  const raw = normalizeText(value) || "none";
  if (!isQcMaterialInspectionDisposition(raw)) {
    throw VALIDATION_ERROR(
      `보류/반출 상태는 ${QC_MATERIAL_INSPECTION_DISPOSITION_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function parseNcrStatus(value: unknown): QcMaterialInspectionNcrStatus {
  const raw = normalizeText(value) || "none";
  if (!isQcMaterialInspectionNcrStatus(raw)) {
    throw VALIDATION_ERROR(`NCR 상태는 ${QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseObjectId(value: unknown, fieldLabel: string): string {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw VALIDATION_ERROR(`${fieldLabel} 식별자 형식이 올바르지 않습니다.`);
  }
  return raw;
}

function parseAttachments(body: Record<string, unknown>) {
  const rows = Array.isArray(body.attachments) ? body.attachments : [];
  const normalized = rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => {
      const fileAssetId = parseObjectId(row.fileAssetId, "첨부 파일");
      const fileName = normalizeText(row.fileName) || fileAssetId;
      const categoryRaw = normalizeText(row.category) || "other";
      if (!isQcAttachmentCategory(categoryRaw)) {
        throw VALIDATION_ERROR("첨부 구분 값이 올바르지 않습니다.");
      }
      const sortOrderValue = Number(row.sortOrder ?? index);
      const sortOrder = Number.isFinite(sortOrderValue) ? Math.max(0, Math.floor(sortOrderValue)) : index;
      return {
        fileAssetId,
        fileName,
        category: categoryRaw,
        sortOrder,
      };
    })
    .filter((row) => Boolean(row.fileAssetId));

  if (normalized.length) {
    return normalized;
  }

  const legacyFileAssetId = parseObjectId(body.fileAssetId, "첨부 파일");
  if (!legacyFileAssetId) {
    return [];
  }

  return [
    {
      fileAssetId: legacyFileAssetId,
      fileName: normalizeText(body.fileName) || legacyFileAssetId,
      category: "other" as const,
      sortOrder: 0,
    },
  ];
}

function parseChecklistItems(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => {
      const label = normalizeText(row.label);
      if (!label) {
        return null;
      }
      assertNoUnsafeHtml(label, "체크리스트 항목");
      const statusRaw = normalizeText(row.status) || "pending";
      if (!isQcMaterialInspectionCheckStatus(statusRaw)) {
        throw VALIDATION_ERROR(
          `체크리스트 상태는 ${QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
        );
      }
      const note = normalizeText(row.note);
      assertNoUnsafeHtml(note, "체크리스트 메모");
      return {
        itemId: normalizeText(row.itemId) || `item-${index + 1}`,
        label,
        status: statusRaw,
        note,
      };
    })
    .filter((row): row is QcMaterialInspectionChecklistItemPayload => Boolean(row));
}

export function normalizeQcMaterialInspectionPayload(
  body: Record<string, unknown>,
  options: { partial: true },
): Partial<QcMaterialInspectionPayload>;
export function normalizeQcMaterialInspectionPayload(
  body: Record<string, unknown>,
  options?: NormalizeOptions,
): QcMaterialInspectionPayload;
export function normalizeQcMaterialInspectionPayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
) {
  const partial = options.partial ?? false;
  const payload: Partial<QcMaterialInspectionPayload> = {};

  if (!partial || body.materialCategory !== undefined) {
    payload.materialCategory = parseMaterialCategory(body.materialCategory);
  }

  if (!partial || body.materialName !== undefined) {
    const materialName = normalizeText(body.materialName);
    if (!materialName) {
      throw VALIDATION_ERROR("자재명은 필수입니다.");
    }
    assertNoUnsafeHtml(materialName, "자재명");
    payload.materialName = materialName;
  }

  if (!partial || body.specification !== undefined) {
    const specification = normalizeText(body.specification);
    assertNoUnsafeHtml(specification, "규격");
    payload.specification = specification;
  }

  if (!partial || body.supplier !== undefined) {
    const supplier = normalizeText(body.supplier);
    assertNoUnsafeHtml(supplier, "공급사");
    payload.supplier = supplier;
  }

  if (!partial || body.lotNo !== undefined) {
    const lotNo = normalizeText(body.lotNo);
    assertNoUnsafeHtml(lotNo, "LOT 번호");
    payload.lotNo = lotNo;
  }

  if (!partial || body.inboundDate !== undefined) {
    payload.inboundDate = parseDate(body.inboundDate, "반입일");
  }

  if (!partial || body.quantity !== undefined) {
    payload.quantity = parseQuantity(body.quantity, "수량");
  }

  if (!partial || body.unit !== undefined) {
    const unit = normalizeText(body.unit);
    assertNoUnsafeHtml(unit, "단위");
    payload.unit = unit;
  }

  if (!partial || body.inspectionDate !== undefined) {
    payload.inspectionDate = parseDate(body.inspectionDate, "검수일");
  }

  if (!partial || body.result !== undefined) {
    payload.result = parseResult(body.result);
  }

  if (!partial || body.disposition !== undefined) {
    payload.disposition = parseDisposition(body.disposition);
  }

  if (!partial || body.inspector !== undefined) {
    const inspector = normalizeText(body.inspector);
    assertNoUnsafeHtml(inspector, "검수자");
    payload.inspector = inspector;
  }

  if (!partial || body.linkedItpPlanId !== undefined) {
    payload.linkedItpPlanId = parseObjectId(body.linkedItpPlanId, "ITP");
  }

  if (!partial || body.linkedItpCheckpointId !== undefined) {
    const linkedItpCheckpointId = normalizeText(body.linkedItpCheckpointId);
    assertNoUnsafeHtml(linkedItpCheckpointId, "ITP 체크포인트");
    payload.linkedItpCheckpointId = linkedItpCheckpointId;
  }

  if (!partial || body.inspectionStandard !== undefined) {
    const inspectionStandard = normalizeText(body.inspectionStandard);
    assertNoUnsafeHtml(inspectionStandard, "검사 기준");
    payload.inspectionStandard = inspectionStandard;
  }

  if (!partial || body.checklistItems !== undefined) {
    payload.checklistItems = parseChecklistItems(body.checklistItems);
  }

  if (!partial || body.decisionReason !== undefined) {
    const decisionReason = normalizeText(body.decisionReason);
    assertNoUnsafeHtml(decisionReason, "판정 사유");
    payload.decisionReason = decisionReason;
  }

  if (!partial || body.remarks !== undefined) {
    const remarks = normalizeText(body.remarks);
    assertNoUnsafeHtml(remarks, "비고");
    payload.remarks = remarks;
  }

  if (!partial || body.attachments !== undefined || body.fileAssetId !== undefined) {
    payload.attachments = parseAttachments(body);
  }

  if (!partial || body.ncrStatus !== undefined) {
    payload.ncrStatus = parseNcrStatus(body.ncrStatus);
  }

  if (!partial || body.ncrReference !== undefined) {
    const ncrReference = normalizeText(body.ncrReference);
    assertNoUnsafeHtml(ncrReference, "NCR 참조");
    payload.ncrReference = ncrReference;
  }

  if (!partial || body.historyNote !== undefined) {
    const historyNote = normalizeText(body.historyNote);
    assertNoUnsafeHtml(historyNote, "이력 메모");
    payload.historyNote = historyNote;
  }

  if (partial) {
    return payload;
  }

  return {
    materialCategory: payload.materialCategory ?? "other",
    materialName: payload.materialName ?? "",
    specification: payload.specification ?? "",
    supplier: payload.supplier ?? "",
    lotNo: payload.lotNo ?? "",
    inboundDate: payload.inboundDate ?? null,
    quantity: payload.quantity ?? 0,
    unit: payload.unit ?? "",
    inspectionDate: payload.inspectionDate ?? null,
    result: payload.result ?? "pending",
    disposition: payload.disposition ?? "none",
    inspector: payload.inspector ?? "",
    linkedItpPlanId: payload.linkedItpPlanId ?? "",
    linkedItpCheckpointId: payload.linkedItpCheckpointId ?? "",
    inspectionStandard: payload.inspectionStandard ?? "",
    checklistItems: payload.checklistItems ?? [],
    decisionReason: payload.decisionReason ?? "",
    remarks: payload.remarks ?? "",
    attachments: payload.attachments ?? [],
    ncrStatus: payload.ncrStatus ?? "none",
    ncrReference: payload.ncrReference ?? "",
    historyNote: payload.historyNote ?? "",
  };
}

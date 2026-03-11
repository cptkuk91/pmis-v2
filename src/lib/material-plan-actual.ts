import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { isMaterialUnit, normalizeMaterialUnit } from "@/lib/material-unit";

export type NormalizedMaterialPlanActualPayload = {
  siteId: string;
  materialName: string;
  specification: string;
  unit: ReturnType<typeof normalizeMaterialUnit>;
  planQty: number;
  actualQty: number;
  planDate?: Date;
  actualDate?: Date;
  supplier: string;
  unitPrice: number;
  remarks: string;
};

function parseNonNegativeNumber(value: unknown, fieldLabel: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw VALIDATION_ERROR(`${fieldLabel} 값이 올바르지 않습니다.`);
  }
  return Math.max(0, parsed);
}

function parseOptionalDate(value: unknown, fieldLabel: string): Date | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

export function normalizeMaterialPlanActualPayload(
  body: Record<string, unknown>,
): NormalizedMaterialPlanActualPayload {
  const siteId = String(body.siteId ?? "").trim();
  const materialName = String(body.materialName ?? "").trim();
  const specification = String(body.specification ?? "").trim();
  const unitInput = String(body.unit ?? "").trim().toUpperCase();
  const supplier = String(body.supplier ?? "").trim();
  const remarks = String(body.remarks ?? "").trim();

  if (!siteId) {
    throw VALIDATION_ERROR("siteId가 필요합니다.");
  }
  if (!mongoose.Types.ObjectId.isValid(siteId)) {
    throw VALIDATION_ERROR("siteId 형식이 올바르지 않습니다.");
  }
  if (!materialName) {
    throw VALIDATION_ERROR("자재명은 필수입니다.");
  }
  if (unitInput && !isMaterialUnit(unitInput)) {
    throw VALIDATION_ERROR("허용되지 않은 단위입니다.");
  }

  return {
    siteId,
    materialName,
    specification,
    unit: normalizeMaterialUnit(unitInput),
    planQty: parseNonNegativeNumber(body.planQty, "계획수량"),
    actualQty: parseNonNegativeNumber(body.actualQty, "실적수량"),
    planDate: parseOptionalDate(body.planDate, "반입 예정일"),
    actualDate: parseOptionalDate(body.actualDate, "입고 완료일"),
    supplier,
    unitPrice: parseNonNegativeNumber(body.unitPrice, "단가"),
    remarks,
  };
}

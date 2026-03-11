import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import {
  isSupplierApprovalType,
  normalizeSupplierApprovalType,
  type SupplierApprovalType,
} from "@/lib/supplier-approval";

function parseRequiredDate(value: unknown, fieldLabel: string): Date {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw VALIDATION_ERROR(`${fieldLabel}은 필수입니다.`);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

export type NormalizedSupplierApprovalPayload = {
  siteId: string;
  approvalType: SupplierApprovalType;
  supplierName: string;
  materialName: string;
  specification: string;
  requestDate: Date;
  remarks: string;
};

export function normalizeSupplierApprovalPayload(
  body: Record<string, unknown>,
): NormalizedSupplierApprovalPayload {
  const siteId = String(body.siteId ?? "").trim();
  const approvalTypeInput = String(body.approvalType ?? "").trim().toLowerCase();
  const supplierName = String(body.supplierName ?? "").trim();
  const materialName = String(body.materialName ?? "").trim();
  const specification = String(body.specification ?? "").trim();
  const remarks = String(body.remarks ?? "").trim();

  if (!siteId) {
    throw VALIDATION_ERROR("siteId가 필요합니다.");
  }
  if (!mongoose.Types.ObjectId.isValid(siteId)) {
    throw VALIDATION_ERROR("siteId 형식이 올바르지 않습니다.");
  }
  if (approvalTypeInput && !isSupplierApprovalType(approvalTypeInput)) {
    throw VALIDATION_ERROR("허용되지 않은 구분입니다.");
  }
  if (!supplierName) {
    throw VALIDATION_ERROR("공급업체는 필수입니다.");
  }
  if (!materialName) {
    throw VALIDATION_ERROR("품목명은 필수입니다.");
  }

  return {
    siteId,
    approvalType: normalizeSupplierApprovalType(approvalTypeInput),
    supplierName,
    materialName,
    specification,
    requestDate: parseRequiredDate(body.requestDate, "요청일"),
    remarks,
  };
}

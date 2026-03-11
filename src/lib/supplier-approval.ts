export const SUPPLIER_APPROVAL_TYPE_OPTIONS = ["material", "equipment"] as const;

export type SupplierApprovalType = (typeof SUPPLIER_APPROVAL_TYPE_OPTIONS)[number];

export const SUPPLIER_APPROVAL_STATUS_OPTIONS = ["pending", "approved", "rejected"] as const;

export type SupplierApprovalStatus = (typeof SUPPLIER_APPROVAL_STATUS_OPTIONS)[number];

export const DEFAULT_SUPPLIER_APPROVAL_TYPE: SupplierApprovalType = "material";

export const DEFAULT_SUPPLIER_APPROVAL_STATUS: SupplierApprovalStatus = "pending";

export const SUPPLIER_APPROVAL_TYPE_LABEL: Record<SupplierApprovalType, string> = {
  material: "자재",
  equipment: "장비",
};

export const SUPPLIER_APPROVAL_STATUS_LABEL: Record<SupplierApprovalStatus, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

export function isSupplierApprovalType(value: string): value is SupplierApprovalType {
  return SUPPLIER_APPROVAL_TYPE_OPTIONS.includes(value as SupplierApprovalType);
}

export function normalizeSupplierApprovalType(value: unknown): SupplierApprovalType {
  const raw = String(value ?? DEFAULT_SUPPLIER_APPROVAL_TYPE).trim().toLowerCase();
  return isSupplierApprovalType(raw) ? raw : DEFAULT_SUPPLIER_APPROVAL_TYPE;
}

export function isSupplierApprovalStatus(value: string): value is SupplierApprovalStatus {
  return SUPPLIER_APPROVAL_STATUS_OPTIONS.includes(value as SupplierApprovalStatus);
}

export function normalizeSupplierApprovalStatus(value: unknown): SupplierApprovalStatus {
  const raw = String(value ?? DEFAULT_SUPPLIER_APPROVAL_STATUS).trim().toLowerCase();
  return isSupplierApprovalStatus(raw) ? raw : DEFAULT_SUPPLIER_APPROVAL_STATUS;
}

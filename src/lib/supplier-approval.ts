export const SUPPLIER_APPROVAL_TYPE_OPTIONS = ["material", "equipment"] as const;

export type SupplierApprovalType = (typeof SUPPLIER_APPROVAL_TYPE_OPTIONS)[number];

export const DEFAULT_SUPPLIER_APPROVAL_TYPE: SupplierApprovalType = "material";

export const SUPPLIER_APPROVAL_TYPE_LABEL: Record<SupplierApprovalType, string> = {
  material: "자재",
  equipment: "장비",
};

export function isSupplierApprovalType(value: string): value is SupplierApprovalType {
  return SUPPLIER_APPROVAL_TYPE_OPTIONS.includes(value as SupplierApprovalType);
}

export function normalizeSupplierApprovalType(value: unknown): SupplierApprovalType {
  const raw = String(value ?? DEFAULT_SUPPLIER_APPROVAL_TYPE).trim().toLowerCase();
  return isSupplierApprovalType(raw) ? raw : DEFAULT_SUPPLIER_APPROVAL_TYPE;
}

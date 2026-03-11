import { VALIDATION_ERROR } from "@/lib/api-error";
import type { SupplierApprovalType } from "@/lib/supplier-approval";
import SupplierApprovalRequest from "@/models/SupplierApprovalRequest";

export type ApprovedSupplierCompanyOption = {
  id: string;
  name: string;
};

function buildApprovalTypeFilter(approvalType: SupplierApprovalType) {
  if (approvalType === "material") {
    return {
      $or: [
        { approvalType: "material" },
        { approvalType: { $exists: false } },
        { approvalType: null },
        { approvalType: "" },
      ],
    };
  }

  return { approvalType };
}

export async function listApprovedSupplierCompanies(
  siteId: string,
  approvalType: SupplierApprovalType,
): Promise<ApprovedSupplierCompanyOption[]> {
  const names = await SupplierApprovalRequest.distinct("supplierName", {
    siteId,
    status: "approved",
    isDeleted: false,
    supplierName: { $ne: "" },
    ...buildApprovalTypeFilter(approvalType),
  });

  return names
    .map((name) => String(name).trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "ko"))
    .map((name) => ({ id: name, name }));
}

export async function ensureApprovedSupplierCompany(
  siteId: string,
  approvalType: SupplierApprovalType,
  supplierName: string,
  fieldLabel: string,
): Promise<void> {
  if (!supplierName) {
    return;
  }

  const exists = await SupplierApprovalRequest.exists({
    siteId,
    status: "approved",
    isDeleted: false,
    supplierName,
    ...buildApprovalTypeFilter(approvalType),
  });

  if (!exists) {
    throw VALIDATION_ERROR(`${fieldLabel}는 업체 승인에서 승인된 업체만 선택할 수 있습니다.`);
  }
}

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import {
  isSupplierApprovalType,
  type SupplierApprovalType,
} from "@/lib/supplier-approval";
import { listApprovedSupplierCompanies } from "@/lib/approved-supplier-company";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const siteId = String(searchParams.get("siteId") ?? "").trim();
    const approvalType = String(searchParams.get("approvalType") ?? "")
      .trim()
      .toLowerCase();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isSupplierApprovalType(approvalType)) {
      throw VALIDATION_ERROR("approvalType이 올바르지 않습니다.");
    }

    const data = await listApprovedSupplierCompanies(siteId, approvalType as SupplierApprovalType);
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

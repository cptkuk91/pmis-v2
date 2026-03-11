import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import CodeGroup from "@/models/CodeGroup";
import CodeItem from "@/models/CodeItem";
import {
  DEFAULT_SUPPLIER_APPROVAL_TYPE,
  isSupplierApprovalType,
  type SupplierApprovalType,
} from "@/lib/supplier-approval";

function getGroupCodeByType(type: SupplierApprovalType) {
  return type === "equipment" ? "EQUIPMENT_SPECIFICATIONS" : "MATERIAL_SPECIFICATIONS";
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const siteId = String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      throw VALIDATION_ERROR("siteId 형식이 올바르지 않습니다.");
    }

    const approvalTypeInput = String(
      request.nextUrl.searchParams.get("approvalType") ?? DEFAULT_SUPPLIER_APPROVAL_TYPE,
    )
      .trim()
      .toLowerCase();

    if (!isSupplierApprovalType(approvalTypeInput)) {
      throw VALIDATION_ERROR("허용되지 않은 구분입니다.");
    }

    const group = await CodeGroup.findOne({
      siteId,
      groupCode: getGroupCodeByType(approvalTypeInput),
      isActive: true,
    }).lean();

    if (!group) {
      return success([]);
    }

    const items = await CodeItem.find({
      siteId,
      groupId: group._id,
      isActive: true,
      isDeleted: false,
    })
      .sort({ sortOrder: 1, itemName: 1 })
      .lean();

    return success(
      items.map((item) => ({
        id: String(item._id),
        code: item.itemCode,
        name: item.itemName,
        description: item.description ?? "",
      })),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

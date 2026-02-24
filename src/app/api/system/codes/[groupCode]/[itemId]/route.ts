import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import CodeGroup from "@/models/CodeGroup";
import CodeItem from "@/models/CodeItem";

type Params = {
  params: Promise<{ groupCode: string; itemId: string }>;
};

function normalizeGroupCode(groupCode: string): string {
  if (groupCode === "partners") {
    return "PARTNERS";
  }
  if (groupCode === "materials") {
    return "MATERIALS";
  }
  if (groupCode === "equipment") {
    return "EQUIPMENT";
  }
  return groupCode.toUpperCase();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("site_admin");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { groupCode, itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const normalizedGroupCode = normalizeGroupCode(groupCode);
    const group = await CodeGroup.findOne({
      siteId,
      groupCode: normalizedGroupCode,
      isActive: true,
    });
    if (!group) {
      throw NOT_FOUND("코드 그룹");
    }

    const item = await CodeItem.findOne({
      _id: itemId,
      siteId,
      groupId: group._id,
    });
    if (!item) {
      throw NOT_FOUND("코드");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextItemCode =
      body.itemCode === undefined ? undefined : String(body.itemCode ?? "").trim().toUpperCase();
    const nextItemName = body.itemName === undefined ? undefined : String(body.itemName ?? "").trim();
    const nextDescription =
      body.description === undefined ? undefined : String(body.description ?? "").trim();
    const nextSortOrder = body.sortOrder === undefined ? undefined : Number(body.sortOrder);
    const nextIsActive = body.isActive === undefined ? undefined : Boolean(body.isActive);

    if (nextItemCode !== undefined && !nextItemCode) {
      throw VALIDATION_ERROR("itemCode는 비워둘 수 없습니다.");
    }
    if (nextItemName !== undefined && !nextItemName) {
      throw VALIDATION_ERROR("itemName은 비워둘 수 없습니다.");
    }
    if (nextItemCode !== undefined) {
      const duplicate = await CodeItem.findOne({
        _id: { $ne: item._id },
        siteId,
        groupId: group._id,
        itemCode: nextItemCode,
        isDeleted: false,
      });
      if (duplicate) {
        throw new ApiError("동일한 itemCode가 이미 존재합니다.", 409, "DUPLICATE_ITEM_CODE");
      }
    }

    if (nextItemCode !== undefined) {
      item.itemCode = nextItemCode;
    }
    if (nextItemName !== undefined) {
      item.itemName = nextItemName;
    }
    if (nextDescription !== undefined) {
      item.description = nextDescription;
    }
    if (nextSortOrder !== undefined && Number.isFinite(nextSortOrder)) {
      item.sortOrder = Math.floor(nextSortOrder);
    }
    if (nextIsActive !== undefined) {
      item.isActive = nextIsActive;
    }
    item.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await item.save();

    await logUpdate(siteId, "system_code_item", itemId, requester);

    return success(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("site_admin");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { groupCode, itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const normalizedGroupCode = normalizeGroupCode(groupCode);
    const group = await CodeGroup.findOne({
      siteId,
      groupCode: normalizedGroupCode,
      isActive: true,
    });
    if (!group) {
      throw NOT_FOUND("코드 그룹");
    }

    const item = await CodeItem.findOne({
      _id: itemId,
      siteId,
      groupId: group._id,
    });
    if (!item) {
      throw NOT_FOUND("코드");
    }

    item.isActive = false;
    item.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;
    await item.softDelete();

    await logDelete(siteId, "system_code_item", itemId, requester);

    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

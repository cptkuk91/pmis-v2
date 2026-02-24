import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import ResourceLibraryItem from "@/models/ResourceLibraryItem";

type Params = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const item = await ResourceLibraryItem.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("자료");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextCategoryCode =
      body.categoryCode === undefined
        ? undefined
        : String(body.categoryCode ?? "").trim().toUpperCase();
    const nextTitle = body.title === undefined ? undefined : String(body.title ?? "").trim();
    const nextDescription =
      body.description === undefined ? undefined : String(body.description ?? "").trim();
    const rawFileAssetId =
      body.fileAssetId === undefined ? undefined : String(body.fileAssetId ?? "").trim();

    if (nextTitle !== undefined && !nextTitle) {
      throw VALIDATION_ERROR("제목은 비워둘 수 없습니다.");
    }
    if (rawFileAssetId && !mongoose.Types.ObjectId.isValid(rawFileAssetId)) {
      throw VALIDATION_ERROR("fileAssetId 형식이 올바르지 않습니다.");
    }

    if (nextCategoryCode !== undefined) {
      item.categoryCode = nextCategoryCode || "GENERAL";
    }
    if (nextTitle !== undefined) {
      item.title = nextTitle;
    }
    if (nextDescription !== undefined) {
      item.description = nextDescription;
    }
    if (rawFileAssetId !== undefined) {
      item.fileAssetId = rawFileAssetId
        ? new mongoose.Types.ObjectId(rawFileAssetId)
        : undefined;
    }
    item.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await item.save();

    await logUpdate(siteId, "library_item", itemId, requester);

    return success(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const item = await ResourceLibraryItem.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("자료");
    }

    item.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;
    await item.softDelete();

    await logDelete(siteId, "library_item", itemId, requester);

    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

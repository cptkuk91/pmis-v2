import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import DocumentSystemItem from "@/models/DocumentSystemItem";

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

    const item = await DocumentSystemItem.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("Document System 항목");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextCode = body.itemCode === undefined ? undefined : String(body.itemCode ?? "").trim().toUpperCase();
    const nextName = body.itemName === undefined ? undefined : String(body.itemName ?? "").trim();
    if (nextCode !== undefined && !nextCode) {
      throw VALIDATION_ERROR("itemCode는 비워둘 수 없습니다.");
    }
    if (nextName !== undefined && !nextName) {
      throw VALIDATION_ERROR("itemName은 비워둘 수 없습니다.");
    }

    if (nextCode !== undefined) {
      item.itemCode = nextCode;
    }
    if (nextName !== undefined) {
      item.itemName = nextName;
    }
    if (body.description !== undefined) {
      item.description = String(body.description ?? "").trim();
    }
    if (body.sortOrder !== undefined) {
      item.sortOrder = Number(body.sortOrder ?? 0);
    }
    if (body.isActive !== undefined) {
      item.isActive = Boolean(body.isActive);
    }
    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.save();

    logUpdate(siteId, "document_system_item", itemId, requester, { updatedFields: Object.keys(body) });
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

    const item = await DocumentSystemItem.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("Document System 항목");
    }

    item.isActive = false;
    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.softDelete();
    logDelete(siteId, "document_system_item", itemId, requester);
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

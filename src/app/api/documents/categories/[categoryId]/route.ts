import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import DocumentCategory from "@/models/DocumentCategory";

type Params = {
  params: Promise<{ categoryId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("site_admin");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { categoryId } = await params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw VALIDATION_ERROR("categoryId 형식이 올바르지 않습니다.");
    }

    const category = await DocumentCategory.findOne({ _id: categoryId, siteId });
    if (!category) {
      throw NOT_FOUND("문서 분류");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextCode = body.categoryCode === undefined ? undefined : String(body.categoryCode ?? "").trim().toUpperCase();
    const nextName = body.categoryName === undefined ? undefined : String(body.categoryName ?? "").trim();
    const parentCategoryId = body.parentCategoryId === undefined ? undefined : String(body.parentCategoryId ?? "").trim();
    if (nextCode !== undefined && !nextCode) {
      throw VALIDATION_ERROR("categoryCode는 비워둘 수 없습니다.");
    }
    if (nextName !== undefined && !nextName) {
      throw VALIDATION_ERROR("categoryName은 비워둘 수 없습니다.");
    }
    if (parentCategoryId && !mongoose.Types.ObjectId.isValid(parentCategoryId)) {
      throw VALIDATION_ERROR("parentCategoryId 형식이 올바르지 않습니다.");
    }

    if (nextCode !== undefined) {
      category.categoryCode = nextCode;
    }
    if (nextName !== undefined) {
      category.categoryName = nextName;
    }
    if (parentCategoryId !== undefined) {
      category.parentCategoryId = parentCategoryId ? new mongoose.Types.ObjectId(parentCategoryId) : undefined;
    }
    if (body.sortOrder !== undefined) {
      category.sortOrder = Number(body.sortOrder ?? 0);
    }
    if (body.isActive !== undefined) {
      category.isActive = Boolean(body.isActive);
    }
    category.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await category.save();

    logUpdate(siteId, "document_category", categoryId, requester, { updatedFields: Object.keys(body) });
    return success(category);
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

    const { categoryId } = await params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw VALIDATION_ERROR("categoryId 형식이 올바르지 않습니다.");
    }

    const category = await DocumentCategory.findOne({ _id: categoryId, siteId });
    if (!category) {
      throw NOT_FOUND("문서 분류");
    }

    category.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    category.isActive = false;
    await category.softDelete();
    logDelete(siteId, "document_category", categoryId, requester);
    return success({ id: categoryId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

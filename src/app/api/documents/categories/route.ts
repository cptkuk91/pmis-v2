import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import {
  generateNextDocumentCategoryCode,
  validateDocumentCategoryParent,
} from "@/lib/document-category-code";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logCreate } from "@/lib/audit-logger";
import DocumentCategory from "@/models/DocumentCategory";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const active = request.nextUrl.searchParams.get("active") ?? "all";
    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ categoryCode: regex }, { categoryName: regex }];
    }
    if (active === "true") {
      filter.isActive = true;
    } else if (active === "false") {
      filter.isActive = false;
    }

    const items = await DocumentCategory.find(filter)
      .sort({ sortOrder: 1, categoryCode: 1 })
      .lean();
    return success(items);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requester = await requireRole("site_admin");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const categoryName = String(body.categoryName ?? "").trim();
    const parentCategoryId = String(body.parentCategoryId ?? "").trim();
    if (!categoryName) {
      throw VALIDATION_ERROR("categoryName은 필수입니다.");
    }

    await validateDocumentCategoryParent(siteId, parentCategoryId || null);
    const categoryCode = await generateNextDocumentCategoryCode(siteId, parentCategoryId || null);

    const created = await DocumentCategory.create({
      siteId,
      categoryCode,
      categoryName,
      parentCategoryId: parentCategoryId ? new mongoose.Types.ObjectId(parentCategoryId) : undefined,
      sortOrder: Number(body.sortOrder ?? 0),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    logCreate(siteId, "document_category", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

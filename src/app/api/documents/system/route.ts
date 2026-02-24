import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logCreate } from "@/lib/audit-logger";
import DocumentSystemItem from "@/models/DocumentSystemItem";

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
      filter.$or = [{ itemCode: regex }, { itemName: regex }, { description: regex }];
    }
    if (active === "true") {
      filter.isActive = true;
    } else if (active === "false") {
      filter.isActive = false;
    }

    const items = await DocumentSystemItem.find(filter)
      .sort({ sortOrder: 1, itemCode: 1 })
      .lean();
    return success(items);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const itemCode = String(body.itemCode ?? "").trim().toUpperCase();
    const itemName = String(body.itemName ?? "").trim();
    if (!itemCode || !itemName) {
      throw VALIDATION_ERROR("itemCode, itemName은 필수입니다.");
    }

    const created = await DocumentSystemItem.create({
      siteId,
      itemCode,
      itemName,
      description: String(body.description ?? "").trim(),
      sortOrder: Number(body.sortOrder ?? 0),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    logCreate(siteId, "document_system_item", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

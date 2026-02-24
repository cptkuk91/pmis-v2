import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logCreate } from "@/lib/audit-logger";
import ResourceLibraryItem from "@/models/ResourceLibraryItem";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

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

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const categoryCode = String(request.nextUrl.searchParams.get("categoryCode") ?? "").trim().toUpperCase();
    const sort = request.nextUrl.searchParams.get("sort") ?? "latest";
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ title: regex }, { description: regex }, { authorName: regex }];
    }
    if (categoryCode && categoryCode !== "ALL") {
      filter.categoryCode = categoryCode;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title_asc: { title: 1 },
      title_desc: { title: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.latest;

    const [items, total] = await Promise.all([
      ResourceLibraryItem.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      ResourceLibraryItem.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
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

    const body = await request.json();
    const categoryCode = String(body.categoryCode ?? "GENERAL").trim().toUpperCase();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const rawFileAssetId = String(body.fileAssetId ?? "").trim();

    if (!title) {
      throw VALIDATION_ERROR("제목은 필수입니다.");
    }
    if (rawFileAssetId && !mongoose.Types.ObjectId.isValid(rawFileAssetId)) {
      throw VALIDATION_ERROR("fileAssetId 형식이 올바르지 않습니다.");
    }

    const created = await ResourceLibraryItem.create({
      siteId,
      categoryCode,
      title,
      description,
      fileAssetId: rawFileAssetId || undefined,
      authorName: requester.userName,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(siteId, "library_item", String(created._id), requester);

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

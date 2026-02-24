import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logCreate } from "@/lib/audit-logger";
import CodeGroup from "@/models/CodeGroup";
import CodeItem from "@/models/CodeItem";

type Params = {
  params: Promise<{ groupCode: string }>;
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("site_admin");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success({ group: null, items: [] });
    }

    const { groupCode } = await params;
    const normalizedGroupCode = normalizeGroupCode(groupCode);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const active = request.nextUrl.searchParams.get("active") ?? "true";
    const sort = request.nextUrl.searchParams.get("sort") ?? "sort_asc";

    const group = await CodeGroup.findOne({
      siteId,
      groupCode: normalizedGroupCode,
      isActive: true,
    }).lean();

    if (!group) {
      return success({ group: null, items: [] });
    }

    const itemFilter: Record<string, unknown> = {
      groupId: group._id,
      siteId,
    };
    if (active === "true") {
      itemFilter.isActive = true;
    } else if (active === "false") {
      itemFilter.isActive = false;
    }
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      itemFilter.$or = [{ itemCode: regex }, { itemName: regex }, { description: regex }];
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      sort_asc: { sortOrder: 1, createdAt: -1 },
      sort_desc: { sortOrder: -1, createdAt: -1 },
      name_asc: { itemName: 1 },
      name_desc: { itemName: -1 },
      code_asc: { itemCode: 1 },
      code_desc: { itemCode: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.sort_asc;

    const items = await CodeItem.find(itemFilter).sort(sortOption).lean();

    return success({ group, items });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("site_admin");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { groupCode } = await params;
    const normalizedGroupCode = normalizeGroupCode(groupCode);
    const body = await request.json();

    const itemCode = String(body.itemCode ?? "").trim().toUpperCase();
    const itemName = String(body.itemName ?? "").trim();
    const description = String(body.description ?? "").trim();
    const sortOrder = Number(body.sortOrder ?? 0);
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

    if (!itemCode || !itemName) {
      throw VALIDATION_ERROR("itemCode, itemName은 필수입니다.");
    }

    let group = await CodeGroup.findOne({
      siteId,
      groupCode: normalizedGroupCode,
    });

    if (!group) {
      group = await CodeGroup.create({
        siteId,
        groupCode: normalizedGroupCode,
        groupName: normalizedGroupCode,
        sortOrder: 0,
        isActive: true,
        createdBy: requester.userId ?? undefined,
        updatedBy: requester.userId ?? undefined,
      });
    }

    const exists = await CodeItem.findOne({
      siteId,
      groupId: group._id,
      itemCode,
      isDeleted: false,
    });

    if (exists) {
      throw new ApiError("동일한 itemCode가 이미 존재합니다.", 409, "DUPLICATE_ITEM_CODE");
    }

    const created = await CodeItem.create({
      siteId,
      groupId: group._id,
      itemCode,
      itemName,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(siteId, "system_code", String(created._id), requester);

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

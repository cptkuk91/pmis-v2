import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SitePersonnel from "@/models/SitePersonnel";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import {
  assertNoDuplicatePersonnel,
  isPersonnelCategory,
  resolvePersonnelIdentity,
} from "@/lib/site-personnel";

type Params = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectDB();

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = String(body.siteId ?? "").trim();
    const category = String(body.category ?? "").trim();
    const selectedUserId = String(body.userId ?? "").trim();
    const company = String(body.company ?? "").trim();
    const position = String(body.position ?? "").trim();
    const role = String(body.role ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isPersonnelCategory(category)) {
      throw VALIDATION_ERROR("분류 값이 올바르지 않습니다.");
    }

    const item = await SitePersonnel.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("관계자");
    }

    const identity = await resolvePersonnelIdentity({
      siteId,
      selectedUserId,
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
    });

    await assertNoDuplicatePersonnel({
      siteId,
      category,
      currentItemId: itemId,
      userId: identity.userId,
      email: identity.email,
      name: identity.name,
      phone,
    });

    item.userId = identity.userId;
    item.category = category;
    item.name = identity.name;
    item.company = company;
    item.position = position;
    item.role = role;
    item.phone = phone;
    item.email = identity.email;
    await item.save();

    await logUpdate(siteId, "site_personnel", itemId, { userId: null, userName: "system" });
    return success(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectDB();

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const siteId = String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const item = await SitePersonnel.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("관계자");
    }

    await item.softDelete();
    await logDelete(siteId, "site_personnel", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

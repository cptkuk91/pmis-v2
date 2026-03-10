import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import ConstructionPlan from "@/models/ConstructionPlan";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";

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
    const title = String(body.title ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!title) {
      throw VALIDATION_ERROR("제목은 필수입니다.");
    }

    const item = await ConstructionPlan.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("시공계획");
    }

    item.title = title;
    item.category = String(body.category ?? "").trim();
    item.description = String(body.description ?? "").trim();
    item.version = String(body.version ?? "").trim();
    await item.save();

    await logUpdate(siteId, "construction_plan", itemId, { userId: null, userName: "system" });
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

    const item = await ConstructionPlan.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("시공계획");
    }

    await item.softDelete();
    await logDelete(siteId, "construction_plan", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

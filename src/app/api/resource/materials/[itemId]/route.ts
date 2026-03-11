import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import MaterialPlanActual from "@/models/MaterialPlanActual";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeMaterialPlanActualPayload } from "@/lib/material-plan-actual";

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
    const payload = normalizeMaterialPlanActualPayload(body);

    const item = await MaterialPlanActual.findOne({ _id: itemId, siteId: payload.siteId });
    if (!item) {
      throw NOT_FOUND("자재 항목");
    }

    item.materialName = payload.materialName;
    item.specification = payload.specification || undefined;
    item.unit = payload.unit;
    item.planQty = payload.planQty;
    item.actualQty = payload.actualQty;
    item.planDate = payload.planDate;
    item.actualDate = payload.actualDate;
    item.supplier = payload.supplier || undefined;
    item.unitPrice = payload.unitPrice;
    item.remarks = payload.remarks || undefined;
    await item.save();

    await logUpdate(payload.siteId, "material", itemId, { userId: null, userName: "system" });
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

    const item = await MaterialPlanActual.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("자재 항목");
    }

    await item.softDelete();
    await logDelete(siteId, "material", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import EquipmentPlanActual from "@/models/EquipmentPlanActual";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeEquipmentPlanActualPayload } from "@/lib/equipment-plan-actual";

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
    const payload = normalizeEquipmentPlanActualPayload(body);

    const item = await EquipmentPlanActual.findOne({ _id: itemId, siteId: payload.siteId });
    if (!item) {
      throw NOT_FOUND("장비 항목");
    }

    item.equipmentName = payload.equipmentName;
    item.specification = payload.specification || undefined;
    item.unit = payload.unit;
    item.planQty = payload.planQty;
    item.actualQty = payload.actualQty;
    item.planDate = payload.planDate;
    item.actualDate = payload.actualDate;
    item.rentalCompany = payload.rentalCompany || undefined;
    item.unitPrice = payload.unitPrice;
    item.remarks = payload.remarks || undefined;
    await item.save();

    await logUpdate(payload.siteId, "equipment", itemId, { userId: null, userName: "system" });
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

    const item = await EquipmentPlanActual.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("장비 항목");
    }

    await item.softDelete();
    await logDelete(siteId, "equipment", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

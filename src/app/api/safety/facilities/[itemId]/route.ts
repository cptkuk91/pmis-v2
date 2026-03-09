import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SafetyFacility from "@/models/SafetyFacility";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";

type Params = {
  params: Promise<{ itemId: string }>;
};

function isFacilityCondition(value: string): value is "good" | "fair" | "poor" {
  return value === "good" || value === "fair" || value === "poor";
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectDB();

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = String(body.siteId ?? "").trim();
    const condition = String(body.condition ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isFacilityCondition(condition)) {
      throw VALIDATION_ERROR("상태 값이 올바르지 않습니다.");
    }

    const item = await SafetyFacility.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("안전시설물");
    }

    item.name = String(body.name ?? "").trim();
    item.location = String(body.location ?? "").trim();
    item.installDate = body.installDate ? new Date(String(body.installDate)) : item.installDate;
    item.condition = condition;
    item.description = String(body.description ?? "").trim();
    await item.save();

    await logUpdate(siteId, "safety_facility", itemId, { userId: null, userName: "system" });
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

    const item = await SafetyFacility.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("안전시설물");
    }

    await item.softDelete();
    await logDelete(siteId, "safety_facility", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

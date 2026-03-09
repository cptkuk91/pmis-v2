import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import AccidentRecord from "@/models/AccidentRecord";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { isAccidentType } from "@/lib/accident-type";

type Params = {
  params: Promise<{ itemId: string }>;
};

function isSeverity(value: string): value is "minor" | "moderate" | "serious" | "fatal" {
  return value === "minor" || value === "moderate" || value === "serious" || value === "fatal";
}

function isStatus(value: string): value is "reported" | "investigating" | "closed" {
  return value === "reported" || value === "investigating" || value === "closed";
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
    const accidentType = String(body.accidentType ?? "").trim();
    const severity = String(body.severity ?? "").trim();
    const status = String(body.status ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isAccidentType(accidentType)) {
      throw VALIDATION_ERROR("사고 유형 값이 올바르지 않습니다.");
    }
    if (!isSeverity(severity)) {
      throw VALIDATION_ERROR("심각도 값이 올바르지 않습니다.");
    }
    if (!isStatus(status)) {
      throw VALIDATION_ERROR("상태 값이 올바르지 않습니다.");
    }

    const item = await AccidentRecord.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("사고/조치 이력");
    }

    item.accidentType = accidentType;
    item.accidentDate = body.accidentDate ? new Date(String(body.accidentDate)) : item.accidentDate;
    item.location = String(body.location ?? "").trim();
    item.description = String(body.description ?? "").trim();
    item.injuredName = String(body.injuredName ?? "").trim();
    item.injuredCompany = String(body.injuredCompany ?? "").trim();
    item.severity = severity;
    item.status = status;
    await item.save();

    await logUpdate(siteId, "safety_completion", itemId, { userId: null, userName: "system" });
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

    const item = await AccidentRecord.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("사고/조치 이력");
    }

    await item.softDelete();
    await logDelete(siteId, "safety_completion", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

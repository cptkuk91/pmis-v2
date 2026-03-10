import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeVisitorPayload } from "@/lib/visitor-log";

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
    const payload = await normalizeVisitorPayload(body);

    const item = await VisitorLog.findOne({ _id: itemId, siteId: payload.siteId });
    if (!item) {
      throw NOT_FOUND("방문자 기록");
    }

    item.visitorName = payload.visitorName;
    item.company = payload.company;
    item.purpose = payload.purpose;
    item.visitDate = new Date(payload.visitDate);
    item.checkInTime = payload.checkInTime;
    item.checkOutTime = payload.checkOutTime;
    item.contactUserId = payload.contactUserId;
    item.contactPerson = payload.contactPerson;
    item.phone = payload.phone;
    item.vehicleNo = payload.vehicleNo;
    await item.save();

    await logUpdate(payload.siteId, "site_visitor", itemId, { userId: null, userName: "system" });
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

    const item = await VisitorLog.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("방문자 기록");
    }

    await item.softDelete();
    await logDelete(siteId, "site_visitor", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

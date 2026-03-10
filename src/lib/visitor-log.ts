import mongoose from "mongoose";
import SiteMembership from "@/models/SiteMembership";
import { VALIDATION_ERROR } from "@/lib/api-error";

export type NormalizedVisitorPayload = {
  siteId: string;
  visitorName: string;
  company: string;
  purpose: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime: string;
  contactUserId?: mongoose.Types.ObjectId;
  contactPerson: string;
  phone: string;
  vehicleNo: string;
};

export async function normalizeVisitorPayload(
  body: Record<string, unknown>,
): Promise<NormalizedVisitorPayload> {
  const siteId = String(body.siteId ?? "").trim();
  const visitorName = String(body.visitorName ?? "").trim();
  const company = String(body.company ?? "").trim();
  const purpose = String(body.purpose ?? "").trim();
  const visitDate = String(body.visitDate ?? "").trim();
  const checkInTime = String(body.checkInTime ?? "").trim();
  const checkOutTime = String(body.checkOutTime ?? "").trim();
  const contactUserIdRaw = String(body.contactUserId ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const vehicleNo = String(body.vehicleNo ?? "").trim();

  if (!siteId) {
    throw VALIDATION_ERROR("siteId가 필요합니다.");
  }
  if (!visitorName) {
    throw VALIDATION_ERROR("방문자명은 필수입니다.");
  }
  if (!purpose) {
    throw VALIDATION_ERROR("방문목적은 필수입니다.");
  }
  if (!visitDate) {
    throw VALIDATION_ERROR("방문일은 필수입니다.");
  }

  let contactUserId: mongoose.Types.ObjectId | undefined;
  let contactPerson = String(body.contactPerson ?? "").trim();

  if (contactUserIdRaw) {
    if (!mongoose.Types.ObjectId.isValid(contactUserIdRaw)) {
      throw VALIDATION_ERROR("면담자 선택 값이 올바르지 않습니다.");
    }
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      throw VALIDATION_ERROR("siteId 형식이 올바르지 않습니다.");
    }

    const membership = await SiteMembership.findOne({
      siteId: new mongoose.Types.ObjectId(siteId),
      userId: new mongoose.Types.ObjectId(contactUserIdRaw),
      isActive: true,
      isDeleted: false,
    })
      .populate("userId", "name isActive isDeleted")
      .select({ userId: 1 })
      .lean();

    const user =
      membership?.userId && typeof membership.userId === "object"
        ? (membership.userId as {
            _id?: unknown;
            name?: string;
            isActive?: boolean;
            isDeleted?: boolean;
          })
        : null;

    if (!membership || !user?._id || !user.name || !user.isActive || user.isDeleted) {
      throw VALIDATION_ERROR("현재 현장에 배치된 면담자만 선택할 수 있습니다.");
    }

    contactUserId = new mongoose.Types.ObjectId(String(user._id));
    contactPerson = String(user.name).trim();
  }

  return {
    siteId,
    visitorName,
    company,
    purpose,
    visitDate,
    checkInTime,
    checkOutTime,
    contactUserId,
    contactPerson,
    phone,
    vehicleNo,
  };
}

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SafetyMileageRecord from "@/models/SafetyMileageRecord";
import SiteMembership from "@/models/SiteMembership";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { isSafetyMileageCategory, normalizeSafetyMileageCategory } from "@/lib/safety-mileage-category";

type Params = {
  params: Promise<{ itemId: string }>;
};

async function resolveMember(siteId: string, userIdRaw: unknown) {
  const userId = String(userIdRaw ?? "").trim();
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw VALIDATION_ERROR("수여대상을 선택하세요.");
  }

  const membership = await SiteMembership.findOne({
    siteId: new mongoose.Types.ObjectId(siteId),
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
    isDeleted: false,
  })
    .populate("userId", "name email role isActive isDeleted")
    .select({ userId: 1, role: 1 })
    .lean();

  const user =
    membership?.userId && typeof membership.userId === "object"
      ? (membership.userId as {
          _id?: unknown;
          name?: string;
          email?: string;
          role?: "super_admin" | "site_admin" | "manager" | "viewer";
          isActive?: boolean;
          isDeleted?: boolean;
        })
      : null;

  if (!membership || !user?._id || !user.name || !user.isActive || user.isDeleted) {
    throw VALIDATION_ERROR("현재 현장에 배치된 사용자만 선택할 수 있습니다.");
  }

  return {
    userId: String(user._id),
    recipientName: String(user.name ?? "").trim(),
    recipientEmail: String(user.email ?? "").trim(),
    membershipRole: membership.role,
    systemRole: user.role ?? "viewer",
  };
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
    const category = String(body.category ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isSafetyMileageCategory(category)) {
      throw VALIDATION_ERROR("분류 값이 올바르지 않습니다.");
    }

    const item = await SafetyMileageRecord.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("안전 포인트");
    }

    const member = await resolveMember(siteId, body.userId);

    item.userId = new mongoose.Types.ObjectId(member.userId);
    item.category = normalizeSafetyMileageCategory(category);
    item.recordDate = body.recordDate ? new Date(String(body.recordDate)) : item.recordDate;
    item.description = String(body.description ?? "").trim();
    item.points = 1;
    item.recipientName = member.recipientName;
    item.recipientEmail = member.recipientEmail;
    item.membershipRole = member.membershipRole;
    item.systemRole = member.systemRole;
    item.managerName = member.recipientName;
    await item.save();

    await logUpdate(siteId, "safety_mileage", itemId, { userId: null, userName: "system" });
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

    const item = await SafetyMileageRecord.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("안전 포인트");
    }

    await item.softDelete();
    await logDelete(siteId, "safety_mileage", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

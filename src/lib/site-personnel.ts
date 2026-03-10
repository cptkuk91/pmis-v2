import mongoose from "mongoose";
import SiteMembership from "@/models/SiteMembership";
import SitePersonnel from "@/models/SitePersonnel";
import { ApiError, VALIDATION_ERROR } from "@/lib/api-error";

export type SitePersonnelCategory = "constructor" | "partner" | "government";

const categoryLabelMap: Record<SitePersonnelCategory, string> = {
  constructor: "시공사",
  partner: "관련사",
  government: "관공서",
};

export function isPersonnelCategory(value: string): value is SitePersonnelCategory {
  return value === "constructor" || value === "partner" || value === "government";
}

type ResolvePersonnelIdentityInput = {
  siteId: string;
  selectedUserId?: string;
  name?: string;
  email?: string;
};

type ResolvePersonnelIdentityResult = {
  userId?: mongoose.Types.ObjectId;
  name: string;
  email: string;
};

export async function resolvePersonnelIdentity({
  siteId,
  selectedUserId = "",
  name = "",
  email = "",
}: ResolvePersonnelIdentityInput): Promise<ResolvePersonnelIdentityResult> {
  const trimmedUserId = selectedUserId.trim();
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!trimmedUserId) {
    if (!trimmedName) {
      throw VALIDATION_ERROR("성명은 필수입니다.");
    }

    return {
      name: trimmedName,
      email: normalizedEmail,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(trimmedUserId)) {
    throw VALIDATION_ERROR("관계자 선택 값이 올바르지 않습니다.");
  }

  const membership = await SiteMembership.findOne({
    siteId: new mongoose.Types.ObjectId(siteId),
    userId: new mongoose.Types.ObjectId(trimmedUserId),
    isActive: true,
    isDeleted: false,
  })
    .populate("userId", "name email isActive isDeleted")
    .select({ userId: 1 })
    .lean();

  const user =
    membership?.userId && typeof membership.userId === "object"
      ? (membership.userId as {
          _id?: unknown;
          name?: string;
          email?: string;
          isActive?: boolean;
          isDeleted?: boolean;
        })
      : null;

  if (!membership || !user?._id || !user.name || !user.isActive || user.isDeleted) {
    throw VALIDATION_ERROR("현재 현장에 배치된 근무자만 선택할 수 있습니다.");
  }

  return {
    userId: new mongoose.Types.ObjectId(String(user._id)),
    name: String(user.name).trim(),
    email: String(user.email ?? "").trim().toLowerCase(),
  };
}

type AssertNoDuplicatePersonnelInput = {
  siteId: string;
  category: SitePersonnelCategory;
  currentItemId?: string;
  userId?: mongoose.Types.ObjectId;
  email?: string;
  name: string;
  phone?: string;
};

export async function assertNoDuplicatePersonnel({
  siteId,
  category,
  currentItemId,
  userId,
  email = "",
  name,
  phone = "",
}: AssertNoDuplicatePersonnelInput): Promise<void> {
  const duplicateConditions: Record<string, unknown>[] = [];

  if (userId) {
    duplicateConditions.push({ userId });
  }
  if (email) {
    duplicateConditions.push({ email });
  }
  if (!userId && !email && phone) {
    duplicateConditions.push({ name, phone });
  }

  if (duplicateConditions.length === 0) {
    return;
  }

  const filter: Record<string, unknown> = {
    siteId,
    isActive: true,
    $or: duplicateConditions,
  };

  if (currentItemId && mongoose.Types.ObjectId.isValid(currentItemId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(currentItemId) };
  }

  const existing = await SitePersonnel.findOne(filter)
    .select({ category: 1, name: 1 })
    .lean();

  if (!existing) {
    return;
  }

  const existingCategory = String(existing.category ?? "");
  if (isPersonnelCategory(existingCategory) && existingCategory !== category) {
    throw new ApiError(
      `${String(existing.name ?? name)}은(는) 이미 ${categoryLabelMap[existingCategory]} 관계자로 등록되어 있습니다.`,
      409,
      "DUPLICATE_SITE_PERSONNEL",
    );
  }

  throw new ApiError("이미 등록된 관계자입니다.", 409, "DUPLICATE_SITE_PERSONNEL");
}

import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logUpdate } from "@/lib/audit-logger";
import SiteMembership from "@/models/SiteMembership";

type MembershipRole = "site_admin" | "manager" | "viewer";

function isMembershipRole(value: unknown): value is MembershipRole {
  return value === "site_admin" || value === "manager" || value === "viewer";
}

function parseMembershipId(rawValue: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(rawValue)) {
    throw NOT_FOUND("현장 사용자 매핑");
  }
  return new mongoose.Types.ObjectId(rawValue);
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw VALIDATION_ERROR(`${fieldName}은 boolean 값이어야 합니다.`);
}

function normalizeSite(value: unknown): { _id: string; siteCode: string; siteName: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!record._id) {
    return null;
  }
  return {
    _id: String(record._id),
    siteCode: String(record.siteCode ?? ""),
    siteName: String(record.siteName ?? ""),
  };
}

function normalizeUser(value: unknown): { _id: string; name: string; email: string; role: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!record._id) {
    return null;
  }
  return {
    _id: String(record._id),
    name: String(record.name ?? ""),
    email: String(record.email ?? ""),
    role: String(record.role ?? "viewer"),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("super_admin");
    await connectDB();

    const { membershipId } = await params;
    const id = parseMembershipId(membershipId);
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = {
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    };

    if (body.role !== undefined) {
      const role = String(body.role ?? "").trim();
      if (!isMembershipRole(role)) {
        throw VALIDATION_ERROR("role은 site_admin | manager | viewer 중 하나여야 합니다.");
      }
      updates.role = role;
    }

    if (body.isActive !== undefined) {
      const isActive = parseBoolean(body.isActive, "isActive");
      updates.isActive = isActive;
      updates.revokedAt = isActive ? undefined : new Date();
    }

    if (Object.keys(updates).length === 1) {
      throw VALIDATION_ERROR("수정할 값이 없습니다.");
    }

    const membership = await SiteMembership.findOneAndUpdate(
      { _id: id, isDeleted: false },
      updates,
      { new: true, runValidators: true },
    )
      .populate("siteId", "siteCode siteName")
      .populate("userId", "name email role")
      .lean();

    if (!membership) {
      throw NOT_FOUND("현장 사용자 매핑");
    }

    const site = normalizeSite(membership.siteId);
    const user = normalizeUser(membership.userId);

    await logUpdate(site?._id ?? "", "site_membership", String(membership._id), requester, updates);

    return success({
      _id: String(membership._id),
      role: membership.role,
      isActive: Boolean(membership.isActive),
      assignedAt: membership.assignedAt ?? null,
      revokedAt: membership.revokedAt ?? null,
      site,
      user,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("super_admin");
    await connectDB();

    const { membershipId } = await params;
    const id = parseMembershipId(membershipId);

    const membership = await SiteMembership.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isActive: false,
        revokedAt: new Date(),
        updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      },
      { new: true, runValidators: true },
    )
      .populate("siteId", "siteCode siteName")
      .populate("userId", "name email role")
      .lean();

    if (!membership) {
      throw NOT_FOUND("현장 사용자 매핑");
    }

    const site = normalizeSite(membership.siteId);
    await logUpdate(site?._id ?? "", "site_membership", String(membership._id), requester, { isActive: false });

    return success({
      _id: String(membership._id),
      isActive: false,
      revokedAt: membership.revokedAt ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

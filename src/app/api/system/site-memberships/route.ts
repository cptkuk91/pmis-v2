import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate, logUpdate } from "@/lib/audit-logger";
import Site from "@/models/Site";
import SiteMembership from "@/models/SiteMembership";
import User from "@/models/User";

type MembershipRole = "site_admin" | "manager" | "viewer";

function isMembershipRole(value: unknown): value is MembershipRole {
  return value === "site_admin" || value === "manager" || value === "viewer";
}

function parseObjectId(rawValue: unknown, fieldName: string): mongoose.Types.ObjectId {
  const value = String(rawValue ?? "").trim();
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw VALIDATION_ERROR(`${fieldName} 값이 유효하지 않습니다.`);
  }
  return new mongoose.Types.ObjectId(value);
}

function toMembershipSummary(item: {
  _id: unknown;
  role: MembershipRole;
  isActive: boolean;
  assignedAt?: Date;
  revokedAt?: Date;
  siteId?: { _id: unknown; siteCode?: string; siteName?: string } | null;
  userId?: { _id: unknown; name?: string; email?: string; role?: string } | null;
}) {
  return {
    _id: String(item._id),
    role: item.role,
    isActive: Boolean(item.isActive),
    assignedAt: item.assignedAt ?? null,
    revokedAt: item.revokedAt ?? null,
    site: item.siteId
      ? {
          _id: String(item.siteId._id),
          siteCode: item.siteId.siteCode ?? "",
          siteName: item.siteId.siteName ?? "",
        }
      : null,
    user: item.userId
      ? {
          _id: String(item.userId._id),
          name: item.userId.name ?? "",
          email: item.userId.email ?? "",
          role: item.userId.role ?? "viewer",
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("super_admin");
    await connectDB();

    const siteIdRaw = request.nextUrl.searchParams.get("siteId");
    const userIdRaw = request.nextUrl.searchParams.get("userId");
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

    const filter: Record<string, unknown> = { isDeleted: false };
    if (!includeInactive) {
      filter.isActive = true;
    }
    if (siteIdRaw) {
      filter.siteId = parseObjectId(siteIdRaw, "siteId");
    }
    if (userIdRaw) {
      filter.userId = parseObjectId(userIdRaw, "userId");
    }

    const [memberships, sites, users] = await Promise.all([
      SiteMembership.find(filter)
        .populate("siteId", "siteCode siteName")
        .populate("userId", "name email role")
        .sort({ assignedAt: -1 })
        .lean(),
      Site.find({ isDeleted: false })
        .select({ _id: 1, siteCode: 1, siteName: 1, status: 1 })
        .sort({ createdAt: 1 })
        .lean(),
      User.find({ isDeleted: false, isActive: true })
        .select({ _id: 1, name: 1, email: 1, role: 1 })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return success({
      memberships: memberships.map((item) =>
        toMembershipSummary({
          _id: item._id,
          role: item.role as MembershipRole,
          isActive: Boolean(item.isActive),
          assignedAt: item.assignedAt,
          revokedAt: item.revokedAt,
          siteId: item.siteId as { _id: unknown; siteCode?: string; siteName?: string } | null,
          userId: item.userId as { _id: unknown; name?: string; email?: string; role?: string } | null,
        }),
      ),
      sites: sites.map((site) => ({
        _id: String(site._id),
        siteCode: site.siteCode,
        siteName: site.siteName,
        status: site.status,
      })),
      users: users.map((user) => ({
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("super_admin");
    await connectDB();

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = parseObjectId(body.siteId, "siteId");
    const userId = parseObjectId(body.userId, "userId");
    const roleRaw = String(body.role ?? "").trim();

    if (!isMembershipRole(roleRaw)) {
      throw VALIDATION_ERROR("role은 site_admin | manager | viewer 중 하나여야 합니다.");
    }

    const [site, user] = await Promise.all([
      Site.findOne({ _id: siteId, isDeleted: false }).select({ _id: 1 }).lean(),
      User.findOne({ _id: userId, isDeleted: false, isActive: true }).select({ _id: 1 }).lean(),
    ]);

    if (!site) {
      throw NOT_FOUND("현장");
    }
    if (!user) {
      throw new ApiError("등록된 활성 사용자만 배정할 수 있습니다.", 422, "USER_NOT_ASSIGNABLE");
    }

    const existing = await SiteMembership.findOne({
      siteId,
      userId,
      isDeleted: false,
    });

    let membershipId: string;
    if (existing) {
      existing.role = roleRaw;
      existing.isActive = true;
      existing.revokedAt = undefined;
      existing.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
      await existing.save();
      membershipId = String(existing._id);
      await logUpdate(String(siteId), "site_membership", membershipId, requester, { role: roleRaw, isActive: true });
    } else {
      const created = await SiteMembership.create({
        siteId,
        userId,
        role: roleRaw,
        isActive: true,
        assignedAt: new Date(),
        createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
        updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      });
      membershipId = String(created._id);
      await logCreate(String(siteId), "site_membership", membershipId, requester, { role: roleRaw });
    }

    const membership = await SiteMembership.findById(membershipId)
      .populate("siteId", "siteCode siteName")
      .populate("userId", "name email role")
      .lean();

    if (!membership) {
      throw NOT_FOUND("현장 사용자 매핑");
    }

    return success(
      toMembershipSummary({
        _id: membership._id,
        role: membership.role as MembershipRole,
        isActive: Boolean(membership.isActive),
        assignedAt: membership.assignedAt,
        revokedAt: membership.revokedAt,
        siteId: membership.siteId as { _id: unknown; siteCode?: string; siteName?: string } | null,
        userId: membership.userId as { _id: unknown; name?: string; email?: string; role?: string } | null,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import Site from "@/models/Site";
import SiteMembership from "@/models/SiteMembership";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logUpdate } from "@/lib/audit-logger";
import { requireRole, type AppRole } from "@/lib/permissions";

type MembershipRole = "site_admin" | "manager" | "viewer";
type SiteStatus = "active" | "completed" | "suspended";

const membershipRoleOrder: Record<MembershipRole, number> = {
  viewer: 1,
  manager: 2,
  site_admin: 3,
};

function normalizeSiteStatus(value: unknown): SiteStatus {
  if (value === "completed" || value === "suspended") {
    return value;
  }
  return "active";
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR("유효한 날짜 형식이 아닙니다.");
  }
  return parsed;
}

async function getMembershipRole(siteId: string, userId: string | null): Promise<MembershipRole | null> {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const membership = await SiteMembership.findOne({
    siteId: new mongoose.Types.ObjectId(siteId),
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
    isDeleted: false,
  })
    .select({ role: 1 })
    .lean();

  return (membership?.role as MembershipRole | undefined) ?? null;
}

async function assertSiteAccess(siteId: string, role: AppRole, userId: string | null): Promise<void> {
  if (role === "super_admin" || role === "dev_bypass") {
    return;
  }

  const membershipRole = await getMembershipRole(siteId, userId);
  if (!membershipRole) {
    throw new ApiError("해당 현장에 대한 접근 권한이 없습니다.", 403, "SITE_ACCESS_DENIED");
  }
}

async function assertSiteAdminAccess(siteId: string, role: AppRole, userId: string | null): Promise<void> {
  if (role === "super_admin" || role === "dev_bypass") {
    return;
  }

  const membershipRole = await getMembershipRole(siteId, userId);
  if (!membershipRole || membershipRoleOrder[membershipRole] < membershipRoleOrder.site_admin) {
    throw new ApiError("현장 수정 권한이 없습니다.", 403, "SITE_EDIT_FORBIDDEN");
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const requester = await requireRole("viewer");
    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw NOT_FOUND("현장");
    }

    await assertSiteAccess(id, requester.role, requester.userId);

    const site = await Site.findOne({ _id: id, isDeleted: false }).populate("projectManager", "name email");
    if (!site) {
      throw NOT_FOUND("현장");
    }

    return success(site);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const requester = await requireRole("site_admin");
    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw NOT_FOUND("현장");
    }

    await assertSiteAdminAccess(id, requester.role, requester.userId);

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedBy: requester.userId ?? undefined,
    };

    if (body.siteName !== undefined) {
      const siteName = String(body.siteName ?? "").trim();
      if (!siteName) {
        throw VALIDATION_ERROR("siteName은 비워둘 수 없습니다.");
      }
      updates.siteName = siteName;
    }

    if (body.address !== undefined) {
      updates.address = String(body.address ?? "").trim() || undefined;
    }

    if (body.description !== undefined) {
      updates.description = String(body.description ?? "").trim() || undefined;
    }

    if (body.status !== undefined) {
      updates.status = normalizeSiteStatus(body.status);
    }

    if (body.startDate !== undefined) {
      updates.startDate = parseDate(body.startDate);
    }

    if (body.endDate !== undefined) {
      updates.endDate = parseDate(body.endDate);
    }

    if (body.projectManager !== undefined) {
      const projectManager = body.projectManager;
      if (!projectManager) {
        updates.projectManager = undefined;
      } else if (mongoose.Types.ObjectId.isValid(String(projectManager))) {
        updates.projectManager = new mongoose.Types.ObjectId(String(projectManager));
      } else {
        throw VALIDATION_ERROR("유효한 projectManager 값이 아닙니다.");
      }
    }

    const site = await Site.findOneAndUpdate({ _id: id, isDeleted: false }, updates, {
      new: true,
      runValidators: true,
    });

    if (!site) {
      throw NOT_FOUND("현장");
    }

    await logUpdate(id, "site", id, requester, updates);
    return success(site);
  } catch (err) {
    return handleApiError(err);
  }
}

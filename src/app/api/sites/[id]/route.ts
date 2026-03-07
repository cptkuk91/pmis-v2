import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import Site from "@/models/Site";
import SiteMembership from "@/models/SiteMembership";
import User from "@/models/User";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
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

async function ensureAssignableUser(userId: string) {
  const user = await User.findOne({
    _id: new mongoose.Types.ObjectId(userId),
    isDeleted: false,
    isActive: true,
  })
    .select({ _id: 1, name: 1, email: 1 })
    .lean();

  if (!user) {
    throw new ApiError("등록된 활성 사용자만 현장소장으로 위임할 수 있습니다.", 422, "USER_NOT_ASSIGNABLE");
  }

  return user;
}

async function delegateProjectManagerMembership(params: {
  siteId: mongoose.Types.ObjectId;
  previousProjectManagerId: string | null;
  nextProjectManagerId: string;
  requesterUserId: string | null;
}) {
  const updatedBy = params.requesterUserId ? new mongoose.Types.ObjectId(params.requesterUserId) : undefined;
  const nextUserObjectId = new mongoose.Types.ObjectId(params.nextProjectManagerId);

  if (
    params.previousProjectManagerId &&
    params.previousProjectManagerId !== params.nextProjectManagerId &&
    mongoose.Types.ObjectId.isValid(params.previousProjectManagerId)
  ) {
    const previousMembership = await SiteMembership.findOne({
      siteId: params.siteId,
      userId: new mongoose.Types.ObjectId(params.previousProjectManagerId),
      isDeleted: false,
      isActive: true,
    });

    if (previousMembership && previousMembership.role === "site_admin") {
      previousMembership.role = "manager";
      previousMembership.updatedBy = updatedBy;
      await previousMembership.save();
    }
  }

  await SiteMembership.findOneAndUpdate(
    {
      siteId: params.siteId,
      userId: nextUserObjectId,
    },
    {
      $set: {
        role: "site_admin",
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        revokedAt: null,
        updatedBy,
      },
      $setOnInsert: {
        assignedAt: new Date(),
        createdBy: updatedBy,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
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

    const site = await Site.findOne({ _id: id, isDeleted: false });
    if (!site) {
      throw NOT_FOUND("현장");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {
      updatedBy: requester.userId ?? undefined,
    };
    const shouldDelegateProjectManager = body.delegateProjectManager === true;
    const previousProjectManagerId = site.projectManager ? String(site.projectManager) : null;
    let nextProjectManagerId: string | null = previousProjectManagerId;

    if (body.siteName !== undefined) {
      const siteName = String(body.siteName ?? "").trim();
      if (!siteName) {
        throw VALIDATION_ERROR("siteName은 비워둘 수 없습니다.");
      }
      site.siteName = siteName;
      updates.siteName = siteName;
    }

    if (body.address !== undefined) {
      const address = String(body.address ?? "").trim() || undefined;
      site.address = address;
      updates.address = address;
    }

    if (body.description !== undefined) {
      const description = String(body.description ?? "").trim() || undefined;
      site.description = description;
      updates.description = description;
    }

    if (body.status !== undefined) {
      const status = normalizeSiteStatus(body.status);
      site.status = status;
      updates.status = status;
    }

    if (body.startDate !== undefined) {
      const startDate = parseDate(body.startDate);
      site.startDate = startDate ?? undefined;
      updates.startDate = startDate;
    }

    if (body.endDate !== undefined) {
      const endDate = parseDate(body.endDate);
      site.endDate = endDate ?? undefined;
      updates.endDate = endDate;
    }

    if (body.projectManager !== undefined) {
      const projectManager = body.projectManager;
      if (!projectManager) {
        site.projectManager = undefined;
        nextProjectManagerId = null;
        updates.projectManager = null;
      } else if (mongoose.Types.ObjectId.isValid(String(projectManager))) {
        const validatedProjectManagerId = String(projectManager);
        await ensureAssignableUser(validatedProjectManagerId);
        site.projectManager = new mongoose.Types.ObjectId(validatedProjectManagerId);
        nextProjectManagerId = validatedProjectManagerId;
        updates.projectManager = validatedProjectManagerId;
      } else {
        throw VALIDATION_ERROR("유효한 projectManager 값이 아닙니다.");
      }
    }

    if (shouldDelegateProjectManager) {
      if (!nextProjectManagerId) {
        throw VALIDATION_ERROR("위임할 현장소장을 선택해 주세요.");
      }

      await ensureAssignableUser(nextProjectManagerId);
      await delegateProjectManagerMembership({
        siteId: site._id,
        previousProjectManagerId,
        nextProjectManagerId,
        requesterUserId: requester.userId,
      });
      updates.delegateProjectManager = nextProjectManagerId;
    }

    site.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await site.save();

    await logUpdate(id, "site", id, requester, updates);
    return success(site);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const requester = await requireRole("super_admin");
    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw NOT_FOUND("현장");
    }

    const site = await Site.findOne({ _id: id, isDeleted: false });
    if (!site) {
      throw NOT_FOUND("현장");
    }

    site.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await site.softDelete();

    await SiteMembership.updateMany(
      { siteId: site._id, isDeleted: false, isActive: true },
      {
        $set: {
          isActive: false,
          revokedAt: new Date(),
          updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
        },
      },
    );

    await logDelete(id, "site", id, requester);
    return success({ id, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

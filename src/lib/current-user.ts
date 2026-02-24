import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isAuthBypassEnabled } from "@/lib/runtime-flags";
import Site from "@/models/Site";
import SiteMembership from "@/models/SiteMembership";
import User from "@/models/User";
import type { Role } from "@/types";

export type CurrentUserRole = Role | "dev_bypass";

export interface CurrentUserContext {
  isAuthenticated: boolean;
  userId: string | null;
  userName: string;
  email: string | null;
  role: CurrentUserRole;
  siteIds: string[];
  isActive: boolean;
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized ? normalized : null;
}

function toUniqueSiteIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function resolveSiteIds(userId: string, role: Role): Promise<string[]> {
  if (role === "super_admin") {
    const allSites = await Site.find({ isDeleted: false }).sort({ createdAt: 1 }).select({ _id: 1 }).lean();
    return toUniqueSiteIds(allSites.map((site) => String(site._id)));
  }

  const memberships = await SiteMembership.find({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
    isDeleted: false,
  })
    .sort({ assignedAt: 1 })
    .select({ siteId: 1 })
    .lean();

  return toUniqueSiteIds(memberships.map((membership) => String(membership.siteId)));
}

async function findOrCreateUser(params: {
  email: string;
  name: string;
  image?: string | null;
}): Promise<{
  id: string;
  role: Role;
  name: string;
  email: string;
  isActive: boolean;
}> {
  let user = await User.findOne({ email: params.email });

  if (!user) {
    const existingUsers = await User.countDocuments({ isDeleted: false });
    const initialRole: Role = existingUsers === 0 ? "super_admin" : "viewer";

    try {
      user = await User.create({
        email: params.email,
        name: params.name || params.email,
        image: params.image ?? undefined,
        provider: "google",
        role: initialRole,
        lastLoginAt: new Date(),
      });
    } catch {
      user = await User.findOne({ email: params.email });
    }
  }

  if (!user) {
    throw new Error("사용자 정보를 생성할 수 없습니다.");
  }

  const nextName = params.name || user.name || params.email;
  const nextImage = params.image ?? user.image;
  const needsProfileSync = user.name !== nextName || user.image !== nextImage || user.provider !== "google";
  if (needsProfileSync) {
    await User.findByIdAndUpdate(user._id, {
      name: nextName,
      image: nextImage,
      provider: "google",
    });
  }

  const freshUser = await User.findById(user._id)
    .select({ _id: 1, role: 1, name: 1, email: 1, isActive: 1 })
    .lean();

  if (!freshUser) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  return {
    id: String(freshUser._id),
    role: freshUser.role,
    name: freshUser.name,
    email: freshUser.email,
    isActive: Boolean(freshUser.isActive),
  };
}

export async function getCurrentUserContextOptional(): Promise<CurrentUserContext | null> {
  if (isAuthBypassEnabled) {
    await connectDB();
    const allSites = await Site.find({ isDeleted: false }).sort({ createdAt: 1 }).select({ _id: 1 }).lean();
    return {
      isAuthenticated: false,
      userId: null,
      userName: "개발 게스트",
      email: null,
      role: "dev_bypass",
      siteIds: toUniqueSiteIds(allSites.map((site) => String(site._id))),
      isActive: true,
    };
  }

  const session = await auth();
  const sessionUser = session?.user;
  const email = normalizeEmail(sessionUser?.email);

  if (!sessionUser || !email) {
    return null;
  }

  await connectDB();

  const dbUser = await findOrCreateUser({
    email,
    name: sessionUser.name ?? "",
    image: sessionUser.image,
  });

  const siteIds = await resolveSiteIds(dbUser.id, dbUser.role);

  return {
    isAuthenticated: true,
    userId: dbUser.id,
    userName: dbUser.name || sessionUser.name || email,
    email,
    role: dbUser.role,
    siteIds,
    isActive: dbUser.isActive,
  };
}

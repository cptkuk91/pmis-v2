import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import Site from "@/models/Site";
import SiteMembership from "@/models/SiteMembership";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { logCreate } from "@/lib/audit-logger";

type SiteStatus = "active" | "completed" | "suspended";

function normalizeSiteStatus(value: unknown): SiteStatus {
  if (value === "completed" || value === "suspended") {
    return value;
  }
  return "active";
}

function parseDate(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toSiteSummary(site: {
  _id: unknown;
  siteCode: string;
  siteName: string;
  address?: string;
  status: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
}) {
  return {
    _id: String(site._id),
    siteCode: site.siteCode,
    siteName: site.siteName,
    address: site.address ?? "",
    status: site.status,
    startDate: site.startDate ?? null,
    endDate: site.endDate ?? null,
    description: site.description ?? "",
  };
}

export async function GET() {
  try {
    const requester = await requireRole("viewer");
    await connectDB();

    if (requester.role === "super_admin" || requester.role === "dev_bypass") {
      const allSites = await Site.find({ isDeleted: false }).sort({ createdAt: 1 }).lean();
      return success(allSites.map(toSiteSummary));
    }

    if (!requester.userId || !mongoose.Types.ObjectId.isValid(requester.userId)) {
      return success([]);
    }

    const memberships = await SiteMembership.find({
      userId: new mongoose.Types.ObjectId(requester.userId),
      isActive: true,
      isDeleted: false,
    })
      .sort({ assignedAt: 1 })
      .select({ siteId: 1 })
      .lean();

    const siteIds = [...new Set(memberships.map((membership) => String(membership.siteId)))];
    if (!siteIds.length) {
      return success([]);
    }

    const sites = await Site.find({ _id: { $in: siteIds }, isDeleted: false }).sort({ createdAt: 1 }).lean();
    return success(sites.map(toSiteSummary));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requester = await requireRole("super_admin");
    await connectDB();

    const body = await request.json();
    const siteCode = String(body.siteCode ?? "")
      .trim()
      .toUpperCase();
    const siteName = String(body.siteName ?? "").trim();
    const address = String(body.address ?? "").trim();
    const description = String(body.description ?? "").trim();
    const status = normalizeSiteStatus(body.status);
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);

    if (!siteCode || !siteName) {
      throw VALIDATION_ERROR("siteCode, siteName은 필수입니다.");
    }

    const duplicated = await Site.findOne({ siteCode, isDeleted: false }).select({ _id: 1 }).lean();
    if (duplicated) {
      throw new ApiError("동일한 현장코드가 이미 존재합니다.", 409, "DUPLICATE_SITE_CODE");
    }

    const site = await Site.create({
      siteCode,
      siteName,
      address: address || undefined,
      description: description || undefined,
      status,
      startDate,
      endDate,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    if (requester.userId && mongoose.Types.ObjectId.isValid(requester.userId)) {
      await SiteMembership.findOneAndUpdate(
        {
          siteId: site._id,
          userId: new mongoose.Types.ObjectId(requester.userId),
        },
        {
          $set: {
            role: "site_admin",
            isActive: true,
            revokedAt: null,
            updatedBy: new mongoose.Types.ObjectId(requester.userId),
          },
          $setOnInsert: {
            assignedAt: new Date(),
            createdBy: new mongoose.Types.ObjectId(requester.userId),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    await logCreate(String(site._id), "site", String(site._id), requester, { siteCode, siteName });

    return success(toSiteSummary(site.toObject()));
  } catch (err) {
    return handleApiError(err);
  }
}

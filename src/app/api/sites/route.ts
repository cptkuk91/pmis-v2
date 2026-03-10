import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import Site from "@/models/Site";
import type { ISite } from "@/models/Site";
import SiteMembership from "@/models/SiteMembership";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { logCreate } from "@/lib/audit-logger";
import { getNextSiteCode } from "@/lib/site-code";
import {
  geocodeSiteCoordinates,
  parseSiteCoordinateInput,
} from "@/lib/site-coordinates";

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

function normalizeProjectManager(
  value: unknown,
): { _id: string; name: string; email: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as { _id?: unknown; name?: unknown; email?: unknown };
  if (!record._id) {
    return null;
  }

  return {
    _id: String(record._id),
    name: String(record.name ?? ""),
    email: String(record.email ?? ""),
  };
}

async function generateNextSiteCode() {
  const existingSites = await Site.find({ isDeleted: false }).select({ siteCode: 1, _id: 0 }).lean();
  return getNextSiteCode(existingSites.map((site) => String(site.siteCode ?? "")));
}

function isDuplicateSiteCodeError(err: unknown) {
  if (!err || typeof err !== "object") {
    return false;
  }

  const code = "code" in err ? err.code : undefined;
  const keyPattern = "keyPattern" in err ? err.keyPattern : undefined;
  const keyValue = "keyValue" in err ? err.keyValue : undefined;

  return (
    code === 11000 &&
    (
      (typeof keyPattern === "object" &&
        keyPattern !== null &&
        "siteCode" in keyPattern &&
        keyPattern.siteCode === 1) ||
      (typeof keyValue === "object" && keyValue !== null && "siteCode" in keyValue)
    )
  );
}

function toSiteSummary(site: {
  _id: unknown;
  siteCode: string;
  siteName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  projectManager?: unknown;
}) {
  return {
    _id: String(site._id),
    siteCode: site.siteCode,
    siteName: site.siteName,
    address: site.address ?? "",
    latitude: site.latitude ?? null,
    longitude: site.longitude ?? null,
    status: site.status,
    startDate: site.startDate ?? null,
    endDate: site.endDate ?? null,
    description: site.description ?? "",
    projectManager: normalizeProjectManager(site.projectManager),
  };
}

export async function GET() {
  try {
    const requester = await requireRole("viewer");
    await connectDB();

    if (requester.role === "super_admin" || requester.role === "dev_bypass") {
      const allSites = await Site.find({ isDeleted: false })
        .populate("projectManager", "name email")
        .sort({ createdAt: 1 })
        .lean();
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

    const sites = await Site.find({ _id: { $in: siteIds }, isDeleted: false })
      .populate("projectManager", "name email")
      .sort({ createdAt: 1 })
      .lean();
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
    const siteName = String(body.siteName ?? "").trim();
    const address = String(body.address ?? "").trim();
    const description = String(body.description ?? "").trim();
    const status = normalizeSiteStatus(body.status);
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    let manualCoordinates;
    try {
      manualCoordinates = parseSiteCoordinateInput({
        latitude: body.latitude,
        longitude: body.longitude,
      });
    } catch (err) {
      throw VALIDATION_ERROR(err instanceof Error ? err.message : "좌표 값이 올바르지 않습니다.");
    }

    if (!siteName) {
      throw VALIDATION_ERROR("siteName은 필수입니다.");
    }

    let latitude: number | undefined = manualCoordinates.latitude;
    let longitude: number | undefined = manualCoordinates.longitude;
    if (!manualCoordinates.isProvided && (address || siteName)) {
      try {
        const coordinates = await geocodeSiteCoordinates({ address, siteName });
        latitude = coordinates?.latitude;
        longitude = coordinates?.longitude;
      } catch {
        latitude = undefined;
        longitude = undefined;
      }
    }

    let siteCode = "";
    let site: mongoose.HydratedDocument<ISite> | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      siteCode = await generateNextSiteCode();

      try {
        site = await Site.create({
          siteCode,
          siteName,
          address: address || undefined,
          latitude,
          longitude,
          description: description || undefined,
          status,
          startDate,
          endDate,
          createdBy: requester.userId ?? undefined,
          updatedBy: requester.userId ?? undefined,
        });
        break;
      } catch (err) {
        if (isDuplicateSiteCodeError(err) && attempt < 4) {
          continue;
        }
        throw err;
      }
    }

    if (!site) {
      throw new ApiError("현장코드 자동 생성에 실패했습니다.", 500, "SITE_CODE_GENERATION_FAILED");
    }

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

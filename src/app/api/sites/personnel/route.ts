import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SitePersonnel from "@/models/SitePersonnel";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import {
  assertNoDuplicatePersonnel,
  isPersonnelCategory,
  resolvePersonnelIdentity,
} from "@/lib/site-personnel";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const category = searchParams.get("category");
    const keyword = String(searchParams.get("q") ?? "").trim();
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (category) filter.category = category;
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { name: regex },
        { company: regex },
        { position: regex },
        { role: regex },
        { email: regex },
      ];
    }

    const [data, total] = await Promise.all([
      SitePersonnel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SitePersonnel.countDocuments(filter),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = (await request.json()) as Record<string, unknown>;
    const siteId = String(body.siteId ?? "").trim();
    const category = String(body.category ?? "").trim();
    const selectedUserId = String(body.userId ?? "").trim();
    const company = String(body.company ?? "").trim();
    const position = String(body.position ?? "").trim();
    const role = String(body.role ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isPersonnelCategory(category)) {
      throw VALIDATION_ERROR("분류 값이 올바르지 않습니다.");
    }

    const identity = await resolvePersonnelIdentity({
      siteId,
      selectedUserId,
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
    });

    await assertNoDuplicatePersonnel({
      siteId,
      category,
      userId: identity.userId,
      email: identity.email,
      name: identity.name,
      phone,
    });

    const doc = await SitePersonnel.create({
      siteId,
      userId: identity.userId,
      category,
      name: identity.name,
      company,
      position,
      role,
      phone,
      email: identity.email,
    });
    await logCreate(siteId, "site_personnel", String(doc._id), { userId: null, userName: "system" });
    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

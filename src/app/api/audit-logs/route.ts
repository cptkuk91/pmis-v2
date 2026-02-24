import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import AuditLog from "@/models/AuditLog";

function parsePositiveInt(raw: string | null, fallback: number, max = 100): number {
  const parsed = Number(raw ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("site_admin");
    await connectDB();

    const sp = request.nextUrl.searchParams;
    const page = parsePositiveInt(sp.get("page"), 1);
    const limit = parsePositiveInt(sp.get("limit"), 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    const siteId = sp.get("siteId");
    if (siteId) filter.siteId = siteId;

    const action = sp.get("action");
    if (action) filter.action = action;

    const entityType = sp.get("entityType");
    if (entityType) filter.entityType = entityType;

    const actorId = sp.get("actorId");
    if (actorId) filter.actorId = actorId;

    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.$gte = new Date(dateFrom);
      if (dateTo) createdAt.$lte = new Date(dateTo);
      filter.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

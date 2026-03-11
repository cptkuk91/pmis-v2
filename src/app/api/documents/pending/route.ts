import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { listPendingDocuments } from "@/lib/document-approval";
import { resolveSiteId } from "@/lib/site-context";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const items = await listPendingDocuments(siteId, { limit });
    return success(items, { total: items.length });
  } catch (err) {
    return handleApiError(err);
  }
}

import mongoose from "mongoose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import Site from "@/models/Site";
import { getCurrentUserContextOptional } from "@/lib/current-user";

function asValidObjectId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
}

export async function resolveSiteId(request?: NextRequest): Promise<string | null> {
  const querySiteId = asValidObjectId(request?.nextUrl.searchParams.get("siteId"));
  const cookieStore = await cookies();
  const cookieSiteId = asValidObjectId(cookieStore.get("pmis_site_id")?.value);
  const preferredSiteId = querySiteId ?? cookieSiteId;
  const currentUser = await getCurrentUserContextOptional();

  if (currentUser) {
    if (!currentUser.siteIds.length) {
      return null;
    }

    if (preferredSiteId && currentUser.siteIds.includes(preferredSiteId)) {
      return preferredSiteId;
    }

    return currentUser.siteIds[0] ?? null;
  }

  if (preferredSiteId) {
    const exists = await Site.exists({ _id: preferredSiteId, isDeleted: false });
    if (exists) {
      return preferredSiteId;
    }
  }

  return null;
}

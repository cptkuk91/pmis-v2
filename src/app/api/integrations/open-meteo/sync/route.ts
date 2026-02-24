import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import IntegrationSyncLog from "@/models/IntegrationSyncLog";
import { syncOpenMeteoForSite } from "@/lib/open-meteo-sync";
import { logCreate } from "@/lib/audit-logger";

function asErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Open-Meteo 동기화 실패";
}

export async function POST(request: NextRequest) {
  let syncLogId: string | null = null;

  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const syncLog = await IntegrationSyncLog.create({
      siteId,
      sourceSystem: "open_meteo",
      syncType: "incremental",
      status: "running",
      startedAt: new Date(),
      recordsProcessed: 0,
      recordsFailed: 0,
      retryCount: 0,
      maxRetries: 3,
      triggeredBy: requester.userId ?? undefined,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });
    syncLogId = String(syncLog._id);

    const result = await syncOpenMeteoForSite({
      siteId,
      days: 7,
      userId: requester.userId,
    });

    await IntegrationSyncLog.findByIdAndUpdate(syncLogId, {
      status: "success",
      completedAt: new Date(),
      recordsProcessed: result.processed,
      recordsFailed: 0,
      errorMessage: null,
      errorDetails: null,
      nextRetryAt: null,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(siteId, "weather_sync", syncLogId!, requester);
    return success({
      syncLogId,
      sourceSystem: "open_meteo",
      status: "success",
      result,
    });
  } catch (err) {
    if (syncLogId) {
      const now = new Date();
      await IntegrationSyncLog.findByIdAndUpdate(syncLogId, {
        status: "failed",
        completedAt: now,
        recordsFailed: 1,
        errorMessage: asErrorMessage(err),
        errorDetails: String(err),
        nextRetryAt: new Date(now.getTime() + 30 * 60 * 1000),
      });
    }
    return handleApiError(err);
  }
}

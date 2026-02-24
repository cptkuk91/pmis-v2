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
  return "Open-Meteo 재시도 실패";
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const now = new Date();
    const failedLogs = await IntegrationSyncLog.find({
      siteId,
      sourceSystem: "open_meteo",
      status: "failed",
      $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }],
    })
      .sort({ startedAt: 1 })
      .limit(3)
      .lean();

    if (failedLogs.length === 0) {
      return success({ retried: 0, successCount: 0, failedCount: 0, details: [] });
    }

    const details: Array<{ logId: string; status: "success" | "failed"; message: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const log of failedLogs) {
      const logId = String(log._id);
      const prevRetryCount = Number(log.retryCount ?? 0);

      await IntegrationSyncLog.findByIdAndUpdate(logId, {
        status: "running",
        syncType: "retry",
        startedAt: new Date(),
        updatedBy: requester.userId ?? undefined,
      });

      try {
        const result = await syncOpenMeteoForSite({
          siteId,
          days: 7,
          userId: requester.userId,
        });

        await IntegrationSyncLog.findByIdAndUpdate(logId, {
          status: "success",
          completedAt: new Date(),
          recordsProcessed: result.processed,
          recordsFailed: 0,
          errorMessage: null,
          errorDetails: null,
          retryCount: prevRetryCount + 1,
          nextRetryAt: null,
          updatedBy: requester.userId ?? undefined,
        });

        details.push({ logId, status: "success", message: `처리 ${result.processed}건` });
        successCount += 1;
      } catch (err) {
        const nextRetryMinutes = Math.min(360, (prevRetryCount + 1) * 30);
        await IntegrationSyncLog.findByIdAndUpdate(logId, {
          status: "failed",
          completedAt: new Date(),
          recordsFailed: 1,
          errorMessage: asErrorMessage(err),
          errorDetails: String(err),
          retryCount: prevRetryCount + 1,
          nextRetryAt: new Date(Date.now() + nextRetryMinutes * 60 * 1000),
          updatedBy: requester.userId ?? undefined,
        });

        details.push({ logId, status: "failed", message: asErrorMessage(err) });
        failedCount += 1;
      }
    }

    await logCreate(siteId, "weather_retry", `retry-${failedLogs.length}`, requester);
    return success({
      retried: failedLogs.length,
      successCount,
      failedCount,
      details,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

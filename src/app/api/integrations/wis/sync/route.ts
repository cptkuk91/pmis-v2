import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import IntegrationSyncLog from "@/models/IntegrationSyncLog";
import { syncWisForSite, type WisInputRecord } from "@/lib/wis-sync";
import { logCreate } from "@/lib/audit-logger";

type SyncRequestBody = {
  records?: WisInputRecord[];
  simulateFailure?: boolean;
};

function asErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "WIS 동기화 실패";
}

async function parseBody(request: NextRequest): Promise<SyncRequestBody> {
  try {
    return (await request.json()) as SyncRequestBody;
  } catch {
    return {};
  }
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

    const body = await parseBody(request);
    if (body.simulateFailure) {
      throw new ApiError("테스트용 WIS 동기화 실패가 요청되었습니다.", 422, "SIMULATED_FAIL");
    }

    const syncLog = await IntegrationSyncLog.create({
      siteId,
      sourceSystem: "wis",
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

    const result = await syncWisForSite({
      siteId,
      userId: requester.userId,
      records: Array.isArray(body.records) ? body.records : undefined,
    });

    await IntegrationSyncLog.findByIdAndUpdate(syncLogId, {
      status: result.failed > 0 ? "failed" : "success",
      completedAt: new Date(),
      recordsProcessed: result.processed,
      recordsFailed: result.failed,
      errorMessage: result.failed > 0 ? `${result.failed}건 처리 실패` : null,
      errorDetails: null,
      nextRetryAt: result.failed > 0 ? new Date(Date.now() + 30 * 60 * 1000) : null,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(siteId, "wis_sync", syncLogId!, requester);
    return success({
      syncLogId,
      sourceSystem: "wis",
      status: result.failed > 0 ? "partial_failed" : "success",
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

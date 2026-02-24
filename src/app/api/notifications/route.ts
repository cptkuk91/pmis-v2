import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { fetchOpenMeteoDailyByAddress } from "@/lib/open-meteo";
import Site from "@/models/Site";
import DocumentModel from "@/models/Document";
import DrawingReview from "@/models/DrawingReview";
import Issue from "@/models/Issue";
import IntegrationSyncLog from "@/models/IntegrationSyncLog";

type NotificationSeverity = "info" | "warning" | "danger";

type NotificationItem = {
  id: string;
  type: "document" | "drawing_review" | "issue" | "weather" | "sync";
  severity: NotificationSeverity;
  title: string;
  message: string;
  href: string;
  timestamp: string;
};

function resolveSyncHref(sourceSystem: string): string {
  if (sourceSystem === "wis") {
    return "/system-admin/integrations/wis";
  }
  if (sourceSystem === "dis") {
    return "/system-admin/integrations/dis";
  }
  if (sourceSystem === "open_meteo") {
    return "/progress/weather";
  }
  return "/system-admin";
}

function toIsoString(value: Date | string | null | undefined): string {
  const date = value ? new Date(value) : new Date(0);
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }
  return date.toISOString();
}

function readDateField(
  row: unknown,
  primaryKey: string,
  fallbackKey?: string,
): Date | string | null {
  const record = row as Record<string, unknown>;
  const primary = record[primaryKey];
  if (primary instanceof Date || typeof primary === "string") {
    return primary;
  }
  if (!fallbackKey) {
    return null;
  }
  const fallback = record[fallbackKey];
  if (fallback instanceof Date || typeof fallback === "string") {
    return fallback;
  }
  return null;
}

export async function GET() {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId();
    if (!siteId) {
      return success({ summary: { unreadCount: 0 }, items: [] as NotificationItem[] });
    }

    const site = await Site.findById(siteId).select({ siteName: 1, address: 1 }).lean();

    const [pendingDocs, pendingDocList, pendingReviewCount, pendingReviewList, openIssueCount, openIssueList, failedSyncCount, failedSyncList] = await Promise.all([
      DocumentModel.countDocuments({ siteId, status: { $in: ["draft", "in_review"] } }),
      DocumentModel.find({ siteId, status: { $in: ["draft", "in_review"] } })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(3)
        .lean(),
      DrawingReview.countDocuments({ siteId, decisionStatus: "pending" }),
      DrawingReview.find({ siteId, decisionStatus: "pending" })
        .sort({ requestedAt: -1, createdAt: -1 })
        .limit(3)
        .lean(),
      Issue.countDocuments({ siteId, status: "open" }),
      Issue.find({ siteId, status: "open" })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(3)
        .lean(),
      IntegrationSyncLog.countDocuments({ siteId, status: "failed" }),
      IntegrationSyncLog.find({ siteId, status: "failed" })
        .sort({ startedAt: -1, createdAt: -1 })
        .limit(2)
        .lean(),
    ]);

    let weatherWarningCount = 0;
    let weatherMessage = "";
    let weatherTimestamp = new Date().toISOString();

    if (site) {
      try {
        const weather = await fetchOpenMeteoDailyByAddress({
          address: site.address,
          siteName: site.siteName,
          days: 2,
        });
        const warnings = weather.weather.filter((item) => item.warning);
        weatherWarningCount = warnings.length;
        if (warnings.length > 0) {
          weatherMessage = warnings
            .map((item) => `${item.observedDate.slice(0, 10)} ${item.warning}`)
            .join(" / ");
          weatherTimestamp = warnings[0]?.observedDate ?? weatherTimestamp;
        }
      } catch {
        weatherWarningCount = 0;
      }
    }

    const items: NotificationItem[] = [];

    if (weatherWarningCount > 0) {
      items.push({
        id: "weather-warning",
        type: "weather",
        severity: "warning",
        title: "기상 특보",
        message: weatherMessage,
        href: "/progress/weather",
        timestamp: weatherTimestamp,
      });
    }

    items.push(
      ...pendingDocList.map((doc) => ({
        id: `doc-${String(doc._id)}`,
        type: "document" as const,
        severity: "info" as const,
        title: `미결문서 ${String(doc.docNo ?? "")}`,
        message: String(doc.title ?? "문서 제목 없음"),
        href: "/dashboard/pending-docs",
        timestamp: toIsoString(readDateField(doc, "updatedAt", "createdAt")),
      })),
    );

    items.push(
      ...pendingReviewList.map((review) => ({
        id: `review-${String(review._id)}`,
        type: "drawing_review" as const,
        severity: "warning" as const,
        title: `도면검토 대기 ${String(review.docNo ?? "")}`,
        message: String(review.drawingName ?? "도면명 없음"),
        href: "/design-docs/design/reviews",
        timestamp: toIsoString(readDateField(review, "requestedAt", "createdAt")),
      })),
    );

    items.push(
      ...openIssueList.map((issue) => ({
        id: `issue-${String(issue._id)}`,
        type: "issue" as const,
        severity: "danger" as const,
        title: "오픈 이슈",
        message: String(issue.title ?? "이슈 제목 없음"),
        href: "/system-admin/common/issues",
        timestamp: toIsoString(readDateField(issue, "updatedAt", "createdAt")),
      })),
    );

    items.push(
      ...failedSyncList.map((syncLog) => ({
        id: `sync-${String(syncLog._id)}`,
        type: "sync" as const,
        severity: "danger" as const,
        title: `연계 실패(${String(syncLog.sourceSystem)})`,
        message: String(syncLog.errorMessage ?? "에러 메시지 없음"),
        href: resolveSyncHref(String(syncLog.sourceSystem ?? "other")),
        timestamp: toIsoString(readDateField(syncLog, "startedAt", "createdAt")),
      })),
    );

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const summary = {
      unreadCount:
        pendingDocs + pendingReviewCount + openIssueCount + weatherWarningCount + failedSyncCount,
      pendingDocs,
      pendingDrawingReviews: pendingReviewCount,
      openIssues: openIssueCount,
      weatherWarnings: weatherWarningCount,
      failedSyncJobs: failedSyncCount,
      siteName: site?.siteName ?? "",
    };

    return success({ summary, items: items.slice(0, 12) });
  } catch (err) {
    return handleApiError(err);
  }
}

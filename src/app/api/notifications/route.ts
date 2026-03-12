import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { countPendingDocuments, listPendingDocuments } from "@/lib/document-approval";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { fetchOpenMeteoDaily } from "@/lib/open-meteo";
import Site from "@/models/Site";
import DrawingReview from "@/models/DrawingReview";
import Issue from "@/models/Issue";
import IntegrationSyncLog from "@/models/IntegrationSyncLog";
import { getQaOpsSnapshot } from "@/lib/qa-ops-summary";

type NotificationSeverity = "info" | "warning" | "danger";

type NotificationItem = {
  id: string;
  type: "document" | "drawing_review" | "issue" | "weather" | "sync" | "qa_capa" | "qa_audit" | "qa_kpi";
  severity: NotificationSeverity;
  title: string;
  message: string;
  href: string;
  timestamp: string;
};

function resolveSyncHref(sourceSystem: string): string {
  if (sourceSystem === "open_meteo") {
    return "/progress/weather";
  }
  if (sourceSystem === "other") {
    return "/system-admin";
  }
  return "/design-docs/design/drawing-viewer";
}

function formatSourceSystem(sourceSystem: string): string {
  if (sourceSystem === "open_meteo") {
    return "Open-Meteo";
  }
  if (sourceSystem === "other") {
    return "기타";
  }
  return "도면 열람 시스템";
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

    const site = await Site.findById(siteId)
      .select({ siteName: 1, address: 1, latitude: 1, longitude: 1 })
      .lean();

    const [pendingDocs, pendingDocList, pendingReviewCount, pendingReviewList, openIssueCount, openIssueList, failedSyncCount, failedSyncList] = await Promise.all([
      countPendingDocuments(siteId),
      listPendingDocuments(siteId, { limit: 3 }),
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const qaSummary = await getQaOpsSnapshot(siteId, {
      limit: 3,
      referenceDate: startOfToday,
      kpiYear: startOfToday.getFullYear(),
    });

    let weatherWarningCount = 0;
    let weatherMessage = "";
    let weatherTimestamp = new Date().toISOString();

    if (site) {
      try {
        const weather = await fetchOpenMeteoDaily({
          address: site.address,
          siteName: site.siteName,
          latitude: site.latitude,
          longitude: site.longitude,
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
        title: `결재 대기 ${String(doc.docNo ?? "")}`,
        message: doc.currentApproverName
          ? `${String(doc.title ?? "문서 제목 없음")} · 현재 결재자 ${doc.currentApproverName}`
          : String(doc.title ?? "문서 제목 없음"),
        href: "/dashboard/pending-docs",
        timestamp: toIsoString(readDateField(doc, "submittedAt", "updatedAt")),
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
      ...qaSummary.overdueCapas.map((capa) => ({
        id: `qa-capa-${String(capa._id)}`,
        type: "qa_capa" as const,
        severity: "danger" as const,
        title: "기한 경과 CAPA",
        message: `${String(capa.title ?? "CAPA 제목 없음")} · 담당 ${String(capa.assigneeName ?? "미지정")}`,
        href: "/qa/capa",
        timestamp: toIsoString(readDateField(capa, "dueDate")),
      })),
    );

    items.push(
      ...qaSummary.pendingAudits.map((audit) => ({
        id: `qa-audit-${String(audit._id)}`,
        type: "qa_audit" as const,
        severity: "warning" as const,
        title: "미완료 내부 심사",
        message: `${audit.auditTitle || "심사 제목 없음"} · 예정 ${toIsoString(audit.plannedDate).slice(0, 10)}`,
        href: "/qa/audits",
        timestamp: toIsoString(readDateField(audit, "plannedDate")),
      })),
    );

    items.push(
      ...qaSummary.kpiAlerts.map((item) => ({
        id: `qa-kpi-${String(item._id)}`,
        type: "qa_kpi" as const,
        severity: "danger" as const,
        title: `경고 KPI ${item.metricCode}`,
        message: item.alertMessage,
        href: `/qa/kpi?alertOnly=true&year=${startOfToday.getFullYear()}`,
        timestamp: startOfToday.toISOString(),
      })),
    );

    items.push(
      ...failedSyncList.map((syncLog) => ({
        id: `sync-${String(syncLog._id)}`,
        type: "sync" as const,
        severity: "danger" as const,
        title: `연계 실패(${formatSourceSystem(String(syncLog.sourceSystem ?? "other"))})`,
        message: String(syncLog.errorMessage ?? "에러 메시지 없음"),
        href: resolveSyncHref(String(syncLog.sourceSystem ?? "other")),
        timestamp: toIsoString(readDateField(syncLog, "startedAt", "createdAt")),
      })),
    );

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const summary = {
      unreadCount:
        pendingDocs +
        pendingReviewCount +
        openIssueCount +
        qaSummary.overdueCapaCount +
        qaSummary.pendingAuditCount +
        qaSummary.kpiAlertCount +
        weatherWarningCount +
        failedSyncCount,
      pendingDocs,
      pendingDrawingReviews: pendingReviewCount,
      openIssues: openIssueCount,
      overdueCapaCount: qaSummary.overdueCapaCount,
      pendingQaAudits: qaSummary.pendingAuditCount,
      qaKpiAlerts: qaSummary.kpiAlertCount,
      weatherWarnings: weatherWarningCount,
      failedSyncJobs: failedSyncCount,
      siteName: site?.siteName ?? "",
    };

    return success({ summary, items: items.slice(0, 12) });
  } catch (err) {
    return handleApiError(err);
  }
}

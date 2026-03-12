import Link from "next/link";
import { connectDB } from "@/lib/db";
import { listPendingDocuments } from "@/lib/document-approval";
import { getQaOpsSnapshot } from "@/lib/qa-ops-summary";
import { resolveSiteId } from "@/lib/site-context";
import Notice from "@/models/Notice";
import { WeatherMiniWidget } from "@/components/layout/weather-mini-widget";

type SidebarNotice = {
  _id: string;
  title: string;
  postedAt: string | Date;
  isPinned: boolean;
};

type SidebarPendingDocument = {
  _id: string;
  docNo: string;
  title: string;
  currentApproverName: string;
  submittedAt?: string | Date | null;
};

function formatDate(value?: string | Date | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("ko-KR");
}

async function getRightWidgetData() {
  await connectDB();
  const siteId = await resolveSiteId();
  if (!siteId) {
    return {
      notices: [] as SidebarNotice[],
      pendingDocs: [] as SidebarPendingDocument[],
      qaSummary: {
        overdueCapaCount: 0,
        pendingAuditCount: 0,
        kpiAlertCount: 0,
      },
    };
  }

  const [notices, pendingDocs, qaOps] = await Promise.all([
    Notice.find({ siteId })
      .sort({ isPinned: -1, postedAt: -1 })
      .limit(3)
      .select({ title: 1, postedAt: 1, isPinned: 1 })
      .lean(),
    listPendingDocuments(siteId, { limit: 3 }),
    getQaOpsSnapshot(siteId, { limit: 3, referenceDate: new Date(), kpiYear: new Date().getFullYear() }),
  ]);

  return {
    notices: notices.map((item) => ({
      _id: String(item._id),
      title: String(item.title ?? ""),
      postedAt: item.postedAt ?? null,
      isPinned: Boolean(item.isPinned),
    })),
    pendingDocs: pendingDocs.map((item) => ({
      _id: item._id,
      docNo: item.docNo,
      title: item.title,
      currentApproverName: item.currentApproverName,
      submittedAt: item.submittedAt ?? null,
    })),
    qaSummary: {
      overdueCapaCount: qaOps.overdueCapaCount,
      pendingAuditCount: qaOps.pendingAuditCount,
      kpiAlertCount: qaOps.kpiAlertCount,
    },
  };
}

export async function RightWidgets() {
  const { notices, pendingDocs, qaSummary } = await getRightWidgetData();

  return (
    <aside className="hidden space-y-4 lg:block">
      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">공지사항</h3>
          <Link
            href="/dashboard/notices"
            className="text-xs font-medium text-foreground-muted transition hover:text-foreground"
          >
            전체보기
          </Link>
        </div>
        {notices.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {notices.map((item) => (
              <li key={item._id} className="rounded-lg border border-border bg-background-soft px-3 py-2">
                <Link href="/dashboard/notices" className="block">
                  <div className="flex items-start gap-2">
                    {item.isPinned ? (
                      <span className="mt-0.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        고정
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        등록일 {formatDate(item.postedAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-foreground-muted">등록된 공지사항이 없습니다.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">결재 대기 문서</h3>
          <Link
            href="/dashboard/pending-docs"
            className="text-xs font-medium text-foreground-muted transition hover:text-foreground"
          >
            전체보기
          </Link>
        </div>
        {pendingDocs.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {pendingDocs.map((item) => (
              <li key={item._id} className="rounded-lg border border-border bg-background-soft px-3 py-2">
                <Link href="/dashboard/pending-docs" className="block">
                  <p className="text-xs font-medium text-foreground-muted">{item.docNo}</p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{item.title}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-foreground-muted">
                    <span>{item.currentApproverName || "결재선 확인 필요"}</span>
                    <span>{formatDate(item.submittedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-foreground-muted">결재 대기 문서가 없습니다.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">QA 운영 경고</h3>
          <Link
            href="/qa/kpi"
            className="text-xs font-medium text-foreground-muted transition hover:text-foreground"
          >
            QA 이동
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          <Link
            href="/qa/audits"
            className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-3 py-2 text-sm hover:bg-background-card"
          >
            <span className="text-foreground">미완료 내부 심사</span>
            <span className="font-semibold text-amber-700">{qaSummary.pendingAuditCount}건</span>
          </Link>
          <Link
            href="/qa/capa?overdueOnly=true"
            className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-3 py-2 text-sm hover:bg-background-card"
          >
            <span className="text-foreground">기한 경과 CAPA</span>
            <span className="font-semibold text-rose-700">{qaSummary.overdueCapaCount}건</span>
          </Link>
          <Link
            href={`/qa/kpi?alertOnly=true&year=${new Date().getFullYear()}`}
            className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-3 py-2 text-sm hover:bg-background-card"
          >
            <span className="text-foreground">경고 KPI</span>
            <span className="font-semibold text-rose-700">{qaSummary.kpiAlertCount}건</span>
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <h3 className="mb-2 text-sm font-semibold text-foreground">날씨</h3>
        <WeatherMiniWidget />
      </section>
    </aside>
  );
}

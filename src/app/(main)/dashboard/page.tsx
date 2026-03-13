import Link from "next/link";
import { connectDB } from "@/lib/db";
import { countPendingDocuments } from "@/lib/document-approval";
import { resolveSiteId } from "@/lib/site-context";
import Notice from "@/models/Notice";
import Meeting from "@/models/Meeting";
import Issue from "@/models/Issue";
import DrawingReview from "@/models/DrawingReview";
import { getQaOpsSnapshot } from "@/lib/qa-ops-summary";
import { getQcOpsSnapshot } from "@/lib/qc-ops-summary";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

async function getDashboardSummary() {
  try {
    await connectDB();
    const siteId = await resolveSiteId();
    if (!siteId) {
      return {
        pendingDocs: 0,
        pendingReviews: 0,
        meetingsToday: 0,
        openIssues: 0,
        notices: 0,
        qaPolicyGoalsActive: 0,
        qaPendingAudits: 0,
        qaOverdueCapas: 0,
        qaKpiAlerts: 0,
        qcOverdueNcrs: 0,
        qcPendingHandovers: 0,
        qcFailedTests: 0,
        qcRiskWorkTypes: 0,
      };
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [notices, meetingsToday, openIssues, pendingDocs, pendingReviews, qaSummary, qcSummary] = await Promise.all([
      Notice.countDocuments({ siteId }),
      Meeting.countDocuments({ siteId, meetingDate: { $gte: startOfDay, $lt: endOfDay } }),
      Issue.countDocuments({ siteId, status: "open" }),
      countPendingDocuments(siteId),
      DrawingReview.countDocuments({ siteId, decisionStatus: "pending" }),
      getQaOpsSnapshot(siteId, { limit: 3, referenceDate: today, kpiYear: today.getFullYear() }),
      getQcOpsSnapshot(siteId, { limit: 3, referenceDate: today, monthsBack: 6 }),
    ]);

    return {
      pendingDocs,
      pendingReviews,
      meetingsToday,
      openIssues,
      notices,
      qaPolicyGoalsActive: qaSummary.activePolicyGoalCount,
      qaPendingAudits: qaSummary.pendingAuditCount,
      qaOverdueCapas: qaSummary.overdueCapaCount,
      qaKpiAlerts: qaSummary.kpiAlertCount,
      qcOverdueNcrs: qcSummary.overdueNcrCount,
      qcPendingHandovers: qcSummary.pendingHandoverCount,
      qcFailedTests: qcSummary.testOutOfSpecCount,
      qcRiskWorkTypes: qcSummary.topRiskWorkTypeCount,
    };
  } catch {
    return {
      pendingDocs: 0,
      pendingReviews: 0,
      meetingsToday: 0,
      openIssues: 0,
      notices: 0,
      qaPolicyGoalsActive: 0,
      qaPendingAudits: 0,
      qaOverdueCapas: 0,
      qaKpiAlerts: 0,
      qcOverdueNcrs: 0,
      qcPendingHandovers: 0,
      qcFailedTests: 0,
      qcRiskWorkTypes: 0,
    };
  }
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const summaryCards = [
    {
      title: "결재 대기 문서",
      value: `${summary.pendingDocs}건`,
      status: "warning" as const,
      href: "/dashboard/pending-docs",
    },
    {
      title: "도면 검토 대기",
      value: `${summary.pendingReviews}건`,
      status: "warning" as const,
      href: "/design-docs/design/reviews",
    },
    {
      title: "금일 회의",
      value: `${summary.meetingsToday}건`,
      status: "info" as const,
      href: "/dashboard/meetings",
    },
    {
      title: "오픈 이슈",
      value: `${summary.openIssues}건`,
      status: "danger" as const,
      href: "/system-admin/common/issues",
    },
    {
      title: "공지사항",
      value: `${summary.notices}건`,
      status: "success" as const,
      href: "/dashboard/notices",
    },
    {
      title: "운영중 품질 목표",
      value: `${summary.qaPolicyGoalsActive}건`,
      status: "info" as const,
      href: "/qa/policy-goals",
    },
  ];
  const qaOperationCards = [
    {
      title: "미완료 내부 심사",
      value: `${summary.qaPendingAudits}건`,
      status: "warning" as const,
      href: "/qa/audits",
    },
    {
      title: "기한 경과 CAPA",
      value: `${summary.qaOverdueCapas}건`,
      status: "danger" as const,
      href: "/qa/capa?overdueOnly=true",
    },
    {
      title: "경고 KPI",
      value: `${summary.qaKpiAlerts}건`,
      status: "danger" as const,
      href: `/qa/kpi?alertOnly=true&year=${new Date().getFullYear()}`,
    },
  ];
  const qcOperationCards = [
    {
      title: "지연 NCR",
      value: `${summary.qcOverdueNcrs}건`,
      status: "danger" as const,
      href: "/qc/nonconformance?overdueOnly=true",
    },
    {
      title: "미조치 인수·준공",
      value: `${summary.qcPendingHandovers}건`,
      status: "warning" as const,
      href: "/qc/handover-inspection?unresolvedOnly=true",
    },
    {
      title: "기준치 이탈 시험",
      value: `${summary.qcFailedTests}건`,
      status: "danger" as const,
      href: "/qc/test-reports",
    },
    {
      title: "QC 리스크 공종",
      value: `${summary.qcRiskWorkTypes}개`,
      status: "info" as const,
      href: "/qc/quality-dashboard",
    },
  ];

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
        <h1 className="text-2xl font-semibold text-foreground">대시보드</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Phase 1 팀1 기준: 인증/권한/공통 레이아웃/공통 UI 컴포넌트가 연결된 상태입니다.
        </p>
        <Link
          href="/dashboard/ui-lab"
          className="mt-4 inline-flex rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
        >
          UI 컴포넌트 테스트 페이지
        </Link>
        <Link
          href="/dashboard/search"
          className="mt-4 ml-2 inline-flex rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
        >
          통합검색 페이지
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => {
          const content = (
            <>
              <p className="text-sm text-foreground-muted">{card.title}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
              <div className="mt-3">
                <StatusBadge status={card.status} />
              </div>
            </>
          );

          if (card.href) {
            return (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-background-soft"
              >
                {content}
              </Link>
            );
          }

          return (
            <article
              key={card.title}
              className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]"
            >
              {content}
            </article>
          );
        })}
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <div>
          <h2 className="text-base font-semibold text-foreground">QA 운영 경고</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            내부 심사, CAPA, KPI 기준으로 즉시 확인이 필요한 품질 운영 항목입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {qaOperationCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-xl border border-border bg-background-soft p-4 transition hover:border-slate-300 hover:bg-background-card"
            >
              <p className="text-sm text-foreground-muted">{card.title}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
              <div className="mt-3">
                <StatusBadge status={card.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">QC 운영 리스크</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              NCR, 인수·준공 검사, 시험 성적서 기준으로 즉시 확인이 필요한 품질 리스크입니다.
            </p>
          </div>
          <Link href="/qc/quality-dashboard" className="text-xs font-medium text-sky-700 hover:underline">
            QC 대시보드 열기
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {qcOperationCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-xl border border-border bg-background-soft p-4 transition hover:border-slate-300 hover:bg-background-card"
            >
              <p className="text-sm text-foreground-muted">{card.title}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
              <div className="mt-3">
                <StatusBadge status={card.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}

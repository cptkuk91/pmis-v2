import Link from "next/link";
import { connectDB } from "@/lib/db";
import { resolveSiteId } from "@/lib/site-context";
import Notice from "@/models/Notice";
import Meeting from "@/models/Meeting";
import Issue from "@/models/Issue";
import DocumentModel from "@/models/Document";
import DrawingReview from "@/models/DrawingReview";
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
      };
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [notices, meetingsToday, openIssues, pendingDocs, pendingReviews] = await Promise.all([
      Notice.countDocuments({ siteId }),
      Meeting.countDocuments({ siteId, meetingDate: { $gte: startOfDay, $lt: endOfDay } }),
      Issue.countDocuments({ siteId, status: "open" }),
      DocumentModel.countDocuments({ siteId, status: { $in: ["draft", "in_review"] } }),
      DrawingReview.countDocuments({ siteId, decisionStatus: "pending" }),
    ]);

    return { pendingDocs, pendingReviews, meetingsToday, openIssues, notices };
  } catch {
    return {
      pendingDocs: 0,
      pendingReviews: 0,
      meetingsToday: 0,
      openIssues: 0,
      notices: 0,
    };
  }
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const summaryCards = [
    { title: "미결 문서", value: `${summary.pendingDocs}건`, status: "warning" as const },
    { title: "검토 대기", value: `${summary.pendingReviews}건`, status: "warning" as const },
    { title: "금일 회의", value: `${summary.meetingsToday}건`, status: "info" as const },
    { title: "신규 이슈", value: `${summary.openIssues}건`, status: "danger" as const },
    { title: "공지사항", value: `${summary.notices}건`, status: "success" as const },
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <article
            key={card.title}
            className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]"
          >
            <p className="text-sm text-foreground-muted">{card.title}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
            <div className="mt-3">
              <StatusBadge status={card.status} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

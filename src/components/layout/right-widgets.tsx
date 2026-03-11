import Link from "next/link";
import { connectDB } from "@/lib/db";
import { listPendingDocuments } from "@/lib/document-approval";
import { resolveSiteId } from "@/lib/site-context";
import Notice from "@/models/Notice";
import { WeatherMiniWidget } from "@/components/layout/weather-mini-widget";

type SidebarNotice = {
  _id: string;
  title: string;
  postedAt: Date;
  isPinned: boolean;
};

type SidebarPendingDocument = {
  _id: string;
  docNo: string;
  title: string;
  currentApproverName: string;
  submittedAt?: Date | null;
};

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("ko-KR");
}

async function getRightWidgetData() {
  try {
    await connectDB();
    const siteId = await resolveSiteId();

    if (!siteId) {
      return {
        notices: [] as SidebarNotice[],
        pendingDocs: [] as SidebarPendingDocument[],
      };
    }

    const [notices, pendingDocs] = await Promise.all([
      Notice.find({ siteId })
        .sort({ isPinned: -1, postedAt: -1 })
        .limit(3)
        .select({ title: 1, postedAt: 1, isPinned: 1 })
        .lean<SidebarNotice[]>(),
      listPendingDocuments(siteId, { limit: 3 }),
    ]);

    return { notices, pendingDocs };
  } catch {
    return {
      notices: [] as SidebarNotice[],
      pendingDocs: [] as SidebarPendingDocument[],
    };
  }
}

export async function RightWidgets() {
  const { notices, pendingDocs } = await getRightWidgetData();

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
        <h3 className="mb-2 text-sm font-semibold text-foreground">날씨</h3>
        <WeatherMiniWidget />
      </section>
    </aside>
  );
}

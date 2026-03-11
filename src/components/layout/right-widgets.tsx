"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

export function RightWidgets() {
  const pathname = usePathname();
  const [notices, setNotices] = useState<SidebarNotice[]>([]);
  const [pendingDocs, setPendingDocs] = useState<SidebarPendingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);

    const [noticeResult, pendingResult] = await Promise.allSettled([
      fetch("/api/dashboard/notices?limit=3&sort=latest", { cache: "no-store" }).then(
        async (response) =>
          (await response.json()) as {
            ok: boolean;
            data?: SidebarNotice[];
          },
      ),
      fetch("/api/documents/pending?limit=3", { cache: "no-store" }).then(
        async (response) =>
          (await response.json()) as {
            ok: boolean;
            data?: SidebarPendingDocument[];
          },
      ),
    ]);

    if (noticeResult.status === "fulfilled" && noticeResult.value.ok) {
      setNotices(Array.isArray(noticeResult.value.data) ? noticeResult.value.data : []);
    } else {
      setNotices([]);
    }

    if (pendingResult.status === "fulfilled" && pendingResult.value.ok) {
      setPendingDocs(Array.isArray(pendingResult.value.data) ? pendingResult.value.data : []);
    } else {
      setPendingDocs([]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

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
          <p className="mt-3 text-sm text-foreground-muted">
            {isLoading ? "공지사항을 불러오는 중..." : "등록된 공지사항이 없습니다."}
          </p>
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
          <p className="mt-3 text-sm text-foreground-muted">
            {isLoading ? "결재 대기 문서를 불러오는 중..." : "결재 대기 문서가 없습니다."}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <h3 className="mb-2 text-sm font-semibold text-foreground">날씨</h3>
        <WeatherMiniWidget />
      </section>
    </aside>
  );
}

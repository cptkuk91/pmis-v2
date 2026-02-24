"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ProgressSummary = {
  reports: number;
  safetyLogs: number;
  scheduleItems: number;
  calendarEvents: number;
  progressPhotos: number;
  delayedTasks: number;
  averageActualProgress: number;
};

type SummaryResponse = {
  ok: boolean;
  data: ProgressSummary;
  error?: string;
};

const defaultSummary: ProgressSummary = {
  reports: 0,
  safetyLogs: 0,
  scheduleItems: 0,
  calendarEvents: 0,
  progressPhotos: 0,
  delayedTasks: 0,
  averageActualProgress: 0,
};

export default function ProgressPage() {
  const [summary, setSummary] = useState<ProgressSummary>(defaultSummary);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/progress/summary", { cache: "no-store" });
      const result = (await response.json()) as SummaryResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "공정 메인 조회 실패");
      }
      setSummary(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정 메인 조회 실패");
      setSummary(defaultSummary);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const cards = [
    { label: "보고서", value: summary.reports, href: "/progress/reports" },
    { label: "공사안전일지", value: summary.safetyLogs, href: "/progress/daily-safety-log" },
    { label: "공정표 항목", value: summary.scheduleItems, href: "/progress/master-schedule" },
    { label: "캘린더 일정", value: summary.calendarEvents, href: "/progress/calendar" },
    { label: "진행사진", value: summary.progressPhotos, href: "/progress/photos" },
    { label: "지연 작업", value: summary.delayedTasks, href: "/progress/comparison" },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">공정 메인</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            보고서/안전일지/공정표/캘린더/기상/진행사진 현황을 통합 조회합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSummary()}
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background-card"
        >
          새로고침
        </button>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-border bg-background-soft p-4 transition hover:bg-background-card"
          >
            <p className="text-sm text-foreground-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {isLoading ? "..." : card.value.toLocaleString("ko-KR")}
            </p>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-background-soft p-4">
        <p className="text-sm text-foreground-muted">평균 실제 진도율</p>
        <p className="mt-2 text-3xl font-semibold text-foreground">
          {isLoading ? "..." : `${summary.averageActualProgress.toFixed(1)}%`}
        </p>
      </div>
    </section>
  );
}

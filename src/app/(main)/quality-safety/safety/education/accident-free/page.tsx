"use client";

import { useEffect, useState, useCallback } from "react";

type AccidentFreeData = {
  total: number;
  inProgress: number;
  achieved: number;
  failed: number;
  records: { _id: string; title: string; targetDays: number; achievedDays: number; startDate: string; status: string }[];
};
const SITE_ID_KEY = "pmis:siteId";
const statusLabel: Record<string, string> = { in_progress: "진행중", achieved: "달성", failed: "미달성" };

export default function AccidentFreeStatusPage() {
  const [data, setData] = useState<AccidentFreeData | null>(null);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/accident-free-status?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setData(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  if (!data) return <section className="space-y-4"><h1 className="text-xl font-semibold text-foreground">무재해 현황</h1><p className="text-sm text-foreground-muted">데이터를 불러오는 중...</p></section>;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">무재해 현황</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-background-card p-4"><p className="text-sm text-foreground-muted">전체</p><p className="text-2xl font-bold text-foreground">{data.total}건</p></div>
        <div className="rounded-lg border border-border bg-background-card p-4"><p className="text-sm text-foreground-muted">진행중</p><p className="text-2xl font-bold text-blue-600">{data.inProgress}건</p></div>
        <div className="rounded-lg border border-border bg-background-card p-4"><p className="text-sm text-foreground-muted">달성</p><p className="text-2xl font-bold text-green-600">{data.achieved}건</p></div>
        <div className="rounded-lg border border-border bg-background-card p-4"><p className="text-sm text-foreground-muted">미달성</p><p className="text-2xl font-bold text-red-600">{data.failed}건</p></div>
      </div>
      <div className="rounded-lg border border-border bg-background-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-background-soft">
            <th className="px-4 py-2 text-left font-medium text-foreground">제목</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">목표일수</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">달성일수</th>
            <th className="px-4 py-2 text-left font-medium text-foreground">시작일</th>
            <th className="px-4 py-2 text-left font-medium text-foreground">상태</th>
          </tr></thead>
          <tbody>
            {data.records.map((r) => (
              <tr key={r._id} className="border-b border-border">
                <td className="px-4 py-2 text-foreground">{r.title}</td>
                <td className="px-4 py-2 text-right text-foreground">{r.targetDays}</td>
                <td className="px-4 py-2 text-right text-foreground">{r.achievedDays}</td>
                <td className="px-4 py-2 text-foreground">{r.startDate?.slice(0, 10)}</td>
                <td className="px-4 py-2 text-foreground">{statusLabel[r.status] ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

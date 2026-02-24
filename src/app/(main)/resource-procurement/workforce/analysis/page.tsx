"use client";

import { useEffect, useState, useCallback } from "react";

type SummaryRow = {
  _id: { company: string; jobType: string };
  totalWorkers: number;
  totalHours: number;
  totalOvertime: number;
};

const SITE_ID_KEY = "pmis:siteId";

export default function WorkforceAnalysisPage() {
  const [data, setData] = useState<SummaryRow[]>([]);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/workforce/summary?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setData(res.data);
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalWorkers = data.reduce((s, r) => s + r.totalWorkers, 0);
  const totalHours = data.reduce((s, r) => s + r.totalHours, 0);
  const totalOvertime = data.reduce((s, r) => s + r.totalOvertime, 0);
  const byCompany = data.reduce<Record<string, { workers: number; hours: number; overtime: number }>>((acc, r) => {
    const key = r._id.company || "미지정";
    if (!acc[key]) acc[key] = { workers: 0, hours: 0, overtime: 0 };
    acc[key].workers += r.totalWorkers;
    acc[key].hours += r.totalHours;
    acc[key].overtime += r.totalOvertime;
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">출역 분석</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">총 출역인원</p>
          <p className="text-2xl font-bold text-foreground">{totalWorkers.toLocaleString()}명</p>
        </div>
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">총 근무시간</p>
          <p className="text-2xl font-bold text-foreground">{totalHours.toLocaleString()}h</p>
        </div>
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">총 잔업시간</p>
          <p className="text-2xl font-bold text-foreground">{totalOvertime.toLocaleString()}h</p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-background-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-background-soft">
            <th className="px-4 py-2 text-left font-medium text-foreground">소속</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">인원</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">근무시간</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">잔업시간</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">비율</th>
          </tr></thead>
          <tbody>
            {Object.entries(byCompany).map(([company, stat]) => (
              <tr key={company} className="border-b border-border">
                <td className="px-4 py-2 text-foreground">{company}</td>
                <td className="px-4 py-2 text-right text-foreground">{stat.workers}</td>
                <td className="px-4 py-2 text-right text-foreground">{stat.hours.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-foreground">{stat.overtime.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-foreground">{totalWorkers > 0 ? ((stat.workers / totalWorkers) * 100).toFixed(1) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

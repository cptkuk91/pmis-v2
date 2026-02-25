"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type RawSummary = {
  _id: { company: string; jobType: string };
  totalWorkers: number;
  totalHours: number;
  totalOvertime: number;
};

type SummaryRow = {
  company: string;
  jobType: string;
  totalWorkers: number;
  totalHours: number;
  totalOvertime: number;
};

const SITE_ID_KEY = "pmis:siteId";

const summaryColumns: DataTableColumn<SummaryRow>[] = [
  { key: "company", header: "소속" },
  { key: "jobType", header: "직종" },
  { key: "totalWorkers", header: "인원수", className: "w-24 text-right" },
  { key: "totalHours", header: "총근무시간", className: "w-28 text-right" },
  { key: "totalOvertime", header: "총잔업시간", className: "w-28 text-right" },
];

const tabs = [
  { key: "summary", label: "집계" },
  { key: "analysis", label: "분석" },
] as const;

export default function WorkforceStatisticsPage() {
  const [rawData, setRawData] = useState<RawSummary[]>([]);
  const [tab, setTab] = useState<"summary" | "analysis">("summary");

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/workforce/summary?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setRawData(res.data);
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summaryRows: SummaryRow[] = rawData.map((r) => ({
    company: r._id.company,
    jobType: r._id.jobType,
    totalWorkers: r.totalWorkers,
    totalHours: r.totalHours,
    totalOvertime: r.totalOvertime,
  }));

  const totalWorkers = rawData.reduce((s, r) => s + r.totalWorkers, 0);
  const totalHours = rawData.reduce((s, r) => s + r.totalHours, 0);
  const totalOvertime = rawData.reduce((s, r) => s + r.totalOvertime, 0);

  const byCompany = rawData.reduce<Record<string, { workers: number; hours: number; overtime: number }>>((acc, r) => {
    const key = r._id.company || "미지정";
    if (!acc[key]) acc[key] = { workers: 0, hours: 0, overtime: 0 };
    acc[key].workers += r.totalWorkers;
    acc[key].hours += r.totalHours;
    acc[key].overtime += r.totalOvertime;
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">근태 통계</h1>

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === t.key ? "bg-[#ecebe8] font-medium text-foreground" : "text-foreground-muted hover:bg-background-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <DataTable columns={summaryColumns} data={summaryRows} rowKey={(row) => `${row.company}-${row.jobType}`} />
      )}

      {tab === "analysis" && (
        <>
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
        </>
      )}
    </section>
  );
}

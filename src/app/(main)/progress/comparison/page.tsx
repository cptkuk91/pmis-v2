"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable } from "@/components/ui";

type ComparisonSummary = {
  totalTasks: number;
  delayedTasks: number;
  avgPlannedProgress: number;
  avgActualProgress: number;
  completionRate: number;
};

type CurvePoint = {
  date: string;
  plannedRate: number;
  actualRate: number;
  gap: number;
};

type ComparisonItem = {
  _id: string;
  taskCode: string;
  taskName: string;
  category: string;
  plannedStart: string;
  plannedEnd: string;
  plannedProgress: number;
  actualProgress: number;
  progressGap: number;
  isDelayed: boolean;
  delayDays: number;
};

type ComparisonResponse = {
  ok: boolean;
  data: {
    summary: ComparisonSummary;
    curve: CurvePoint[];
    items: ComparisonItem[];
  };
  error?: string;
};

const emptySummary: ComparisonSummary = {
  totalTasks: 0,
  delayedTasks: 0,
  avgPlannedProgress: 0,
  avgActualProgress: 0,
  completionRate: 0,
};

export default function ProgressComparisonPage() {
  const [summary, setSummary] = useState<ComparisonSummary>(emptySummary);
  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delayedItems = useMemo(
    () => items.filter((item) => item.isDelayed).sort((a, b) => b.delayDays - a.delayDays),
    [items],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/progress/comparison", { cache: "no-store" });
      const result = (await response.json()) as ComparisonResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "실적대비 조회 실패");
      }

      setSummary(result.data.summary);
      setCurve(result.data.curve);
      setItems(result.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "실적대비 조회 실패");
      setSummary(emptySummary);
      setCurve([]);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">실적대비 (S-Curve)</h1>
          <p className="mt-1 text-sm text-foreground-muted">누적 계획 대비 실적 곡선을 비교하고 지연 항목을 추적합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background-card"
        >
          새로고침
        </button>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">총 작업</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.totalTasks.toLocaleString("ko-KR")}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">지연 작업</p>
          <p className="mt-2 text-2xl font-semibold text-danger">{summary.delayedTasks.toLocaleString("ko-KR")}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">평균 계획</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.avgPlannedProgress.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">평균 실적</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.avgActualProgress.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">완료율</p>
          <p className="mt-2 text-2xl font-semibold text-success">{summary.completionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background-soft p-4">
        <h2 className="text-sm font-semibold text-foreground">S-Curve</h2>
        <div className="mt-3 h-80 w-full">
          {curve.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
              {isLoading ? "불러오는 중..." : "차트 데이터가 없습니다."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e3" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#787774" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#787774" }} />
                <Tooltip
                  formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
                  labelFormatter={(label) => `기준일 ${label}`}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e6e5e3",
                    backgroundColor: "#ffffff",
                    color: "#37352f",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="plannedRate"
                  name="계획"
                  stroke="#2f76d2"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actualRate"
                  name="실적"
                  stroke="#217a4f"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <DataTable<ComparisonItem>
        columns={[
          { key: "taskCode", header: "작업코드", className: "w-28" },
          { key: "taskName", header: "작업명" },
          { key: "category", header: "분류", className: "w-20" },
          {
            key: "plannedEnd",
            header: "계획종료",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "plannedProgress",
            header: "계획",
            className: "w-20 text-right",
            render: (value) => `${Number(value).toFixed(1)}%`,
          },
          {
            key: "actualProgress",
            header: "실적",
            className: "w-20 text-right",
            render: (value) => `${Number(value).toFixed(1)}%`,
          },
          {
            key: "progressGap",
            header: "진도차",
            className: "w-24 text-right",
            render: (value) => {
              const numeric = Number(value);
              const tone = numeric >= 0 ? "text-success" : "text-danger";
              return <span className={`font-medium ${tone}`}>{numeric > 0 ? `+${numeric}` : numeric}%</span>;
            },
          },
          {
            key: "delayDays",
            header: "지연일수",
            className: "w-24 text-right",
            render: (value, row) => (row.isDelayed ? `${Number(value)}일` : "-"),
          },
        ]}
        data={delayedItems.slice(0, 10)}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "지연 작업이 없습니다."}
      />
    </section>
  );
}

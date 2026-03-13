"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QcFeedbackBanners } from "@/components/qc/feedback-banners";
import { QcFilterPanel } from "@/components/qc/filter-panel";
import { DataTable } from "@/components/ui/data-table";
import type { DataTableColumn } from "@/components/ui/data-table";
import { QC_HANDOVER_APPROVAL_STATUS_LABELS, QC_HANDOVER_INSPECTION_TYPE_LABELS } from "@/lib/qc-handover-inspections";
import { QC_NONCONFORMANCE_SEVERITY_LABELS } from "@/lib/qc-nonconformance";
import { QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_LABELS } from "@/lib/qc-process-inspections";
import { QC_TEST_REPORT_TYPE_LABELS } from "@/lib/qc-test-reports";

type QcOpsOverdueNcrItem = {
  _id: string;
  ncrNo: string;
  title: string;
  workType: string;
  severity: string;
  assigneeName: string;
  dueDate?: string | null;
};

type QcOpsPendingHandoverItem = {
  _id: string;
  inspectionNo: string;
  inspectionTitle: string;
  inspectionType: string;
  workType: string;
  areaSummary: string;
  openFindingCount: number;
  approvalStatus: string;
  plannedInspectionDate?: string | null;
};

type QcOpsFailedTestItem = {
  _id: string;
  sampleName: string;
  certificateNo: string;
  testType: string;
  deviationRate: number;
  summary: string;
  testDate?: string | null;
};

type QcOpsOpenProcessActionItem = {
  _id: string;
  inspectionTitle: string;
  workType: string;
  location: string;
  correctiveActionStatus: string;
  plannedInspectionDate?: string | null;
};

type QcOpsWorkTypeRiskItem = {
  workType: string;
  processInspectionCount: number;
  processFailCount: number;
  openCorrectiveActionCount: number;
  ncrCount: number;
  overdueNcrCount: number;
  pendingHandoverCount: number;
  riskScore: number;
  actions?: string;
};

type QcOpsTrendPoint = {
  key: string;
  label: string;
  materialInspectionCount: number;
  materialPassRate: number;
  processInspectionCount: number;
  processOpenActionCount: number;
  testOutOfSpecCount: number;
  ncrCount: number;
  handoverPendingCount: number;
};

type QcQualityDashboardSummary = {
  generatedAt: string;
  range: {
    monthsBack: number;
    start: string;
    end: string;
  };
  snapshot: {
    monthsBack: number;
    materialInspectionCount: number;
    materialPassCount: number;
    materialFailCount: number;
    materialPassRate: number;
    processOpenActionCount: number;
    processFailCount: number;
    testOutOfSpecCount: number;
    periodNcrCount: number;
    openNcrCount: number;
    overdueNcrCount: number;
    pendingHandoverCount: number;
    approvalRequestedHandoverCount: number;
    topRiskWorkTypeCount: number;
    topRiskWorkTypes: QcOpsWorkTypeRiskItem[];
    overdueNcrs: QcOpsOverdueNcrItem[];
    pendingHandovers: QcOpsPendingHandoverItem[];
    failedTests: QcOpsFailedTestItem[];
    openProcessActions: QcOpsOpenProcessActionItem[];
  };
  trend: QcOpsTrendPoint[];
  workTypeRisks: QcOpsWorkTypeRiskItem[];
};

type SummaryResponse = {
  ok: boolean;
  data?: QcQualityDashboardSummary;
  error?: string;
};

const MONTH_OPTIONS = [
  { value: 3, label: "최근 3개월" },
  { value: 6, label: "최근 6개월" },
  { value: 12, label: "최근 12개월" },
];

const emptySummary: QcQualityDashboardSummary = {
  generatedAt: "",
  range: {
    monthsBack: 6,
    start: "",
    end: "",
  },
  snapshot: {
    monthsBack: 6,
    materialInspectionCount: 0,
    materialPassCount: 0,
    materialFailCount: 0,
    materialPassRate: 0,
    processOpenActionCount: 0,
    processFailCount: 0,
    testOutOfSpecCount: 0,
    periodNcrCount: 0,
    openNcrCount: 0,
    overdueNcrCount: 0,
    pendingHandoverCount: 0,
    approvalRequestedHandoverCount: 0,
    topRiskWorkTypeCount: 0,
    topRiskWorkTypes: [],
    overdueNcrs: [],
    pendingHandovers: [],
    failedTests: [],
    openProcessActions: [],
  },
  trend: [],
  workTypeRisks: [],
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDate(value);
  }
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function RiskPill({ score }: { score: number }) {
  const toneClass =
    score >= 12
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : score >= 6
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      리스크 {score}
    </span>
  );
}

export default function QcQualityDashboardPage() {
  const [monthsBack, setMonthsBack] = useState(6);
  const [reloadToken, setReloadToken] = useState(0);
  const [summary, setSummary] = useState<QcQualityDashboardSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/qc/quality-dashboard/summary?months=${monthsBack}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as SummaryResponse;
        if (!result.ok || !result.data) {
          throw new Error(result.error ?? "품질 대시보드 조회 실패");
        }

        if (!cancelled) {
          setSummary(result.data);
        }
      } catch (err) {
        if (!cancelled) {
          setSummary(emptySummary);
          setError(err instanceof Error ? err.message : "품질 대시보드 조회 실패");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [monthsBack, reloadToken]);

  const workTypeColumns: DataTableColumn<QcOpsWorkTypeRiskItem>[] = [
    {
      key: "workType",
      header: "공종",
      className: "min-w-[180px]",
      render: (_, row) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{row.workType}</div>
          <div className="text-xs text-foreground-muted">공정 {row.processInspectionCount}건 / NCR {row.ncrCount}건</div>
        </div>
      ),
    },
    {
      key: "openCorrectiveActionCount",
      header: "공정 리스크",
      className: "min-w-[170px]",
      render: (_, row) => (
        <div className="space-y-1 text-sm">
          <div>불합격 {row.processFailCount}건</div>
          <div className="text-foreground-muted">미조치 {row.openCorrectiveActionCount}건</div>
        </div>
      ),
    },
    {
      key: "overdueNcrCount",
      header: "NCR",
      className: "min-w-[150px]",
      render: (_, row) => (
        <div className="space-y-1 text-sm">
          <div>발생 {row.ncrCount}건</div>
          <div className="text-foreground-muted">지연 {row.overdueNcrCount}건</div>
        </div>
      ),
    },
    {
      key: "pendingHandoverCount",
      header: "인수·준공",
      className: "min-w-[120px]",
      render: (value) => <span>{Number(value ?? 0)}건</span>,
    },
    {
      key: "riskScore",
      header: "리스크 점수",
      className: "min-w-[120px]",
      render: (value) => <RiskPill score={Number(value ?? 0)} />,
    },
    {
      key: "actions",
      header: "연결",
      className: "w-[220px]",
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/qc/process-inspection"
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
          >
            공정 검사
          </Link>
          <Link
            href={`/qc/nonconformance${row.overdueNcrCount > 0 ? "?overdueOnly=true" : ""}`}
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
          >
            NCR
          </Link>
          <Link
            href={`/qc/handover-inspection${row.pendingHandoverCount > 0 ? "?unresolvedOnly=true" : ""}`}
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
          >
            인수·준공
          </Link>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">QC 품질 대시보드</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              자재 검사, 공정 검사, 시험 성적서, NCR, 인수·준공 검사의 운영 리스크를 한눈에 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-sky-700">
            <Link href="/qc/material-inspection" className="hover:underline">
              자재 검사
            </Link>
            <Link href="/qc/process-inspection" className="hover:underline">
              공정 검사
            </Link>
            <Link href="/qc/test-reports" className="hover:underline">
              시험 성적서
            </Link>
            <Link href="/qc/nonconformance" className="hover:underline">
              NCR
            </Link>
            <Link href="/qc/handover-inspection" className="hover:underline">
              인수·준공 검사
            </Link>
          </div>
        </div>
      </header>

      <QcFeedbackBanners error={error} />

      <QcFilterPanel
        description="최근 기간 기준 추이와 현재 미종결 리스크를 함께 봅니다."
        actions={
          <button
            type="button"
            onClick={() => setReloadToken((previous) => previous + 1)}
            className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background-card"
          >
            새로고침
          </button>
        }
        footer={
          <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
            <span>
              집계 기간 {formatDate(summary.range.start)} ~ {formatDate(summary.range.end)}
            </span>
            <span>갱신 {formatDateTime(summary.generatedAt)}</span>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">집계 기간</span>
            <select
              value={monthsBack}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                startTransition(() => setMonthsBack(nextValue));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
              자재 합격률은 <code>pass / (pass + fail + reinspection)</code> 기준입니다.
            </div>
            <div className="rounded-lg border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
              공정 미조치는 현재 <code>requested / in_progress</code> 조치 건수 기준입니다.
            </div>
            <div className="rounded-lg border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
              NCR 지연은 오늘 기준 <code>status != closed && dueDate &lt; today</code> 기준입니다.
            </div>
          </div>
        </div>
      </QcFilterPanel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-foreground-muted">자재 합격률</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatPercent(summary.snapshot.materialPassRate)}</p>
          <p className="mt-1 text-xs text-foreground-muted">
            합격 {summary.snapshot.materialPassCount}건 / 이탈 {summary.snapshot.materialFailCount}건
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-amber-800">공정 미조치</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{summary.snapshot.processOpenActionCount}건</p>
          <p className="mt-1 text-xs text-amber-700">조치중 또는 조치 요청 상태</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-rose-800">기준치 이탈 시험</p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">{summary.snapshot.testOutOfSpecCount}건</p>
          <p className="mt-1 text-xs text-rose-700">최근 {summary.snapshot.monthsBack}개월 부적합 시험</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-foreground-muted">미종결 NCR</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.snapshot.openNcrCount}건</p>
          <p className="mt-1 text-xs text-foreground-muted">기간 발생 {summary.snapshot.periodNcrCount}건</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-rose-800">지연 NCR</p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">{summary.snapshot.overdueNcrCount}건</p>
          <p className="mt-1 text-xs text-rose-700">기한 초과 미종결 NCR</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-sky-800">미조치 인수·준공</p>
          <p className="mt-2 text-2xl font-semibold text-sky-900">{summary.snapshot.pendingHandoverCount}건</p>
          <p className="mt-1 text-xs text-sky-700">승인 요청 {summary.snapshot.approvalRequestedHandoverCount}건</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">기간별 자재 합격률 / NCR 발생</h2>
              <p className="mt-1 text-sm text-foreground-muted">최근 기간의 검사 품질과 NCR 발생 추이를 함께 봅니다.</p>
            </div>
            <Link href="/qc/nonconformance" className="text-xs font-medium text-sky-700 hover:underline">
              NCR 상세
            </Link>
          </div>
          <div className="mt-3 h-80 w-full">
            {summary.trend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
                {isLoading ? "불러오는 중..." : "추이 데이터가 없습니다."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.trend} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#787774" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#787774" }} domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#787774" }} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "자재 합격률" ? `${Number(value ?? 0).toFixed(1)}%` : `${Number(value ?? 0)}건`
                    }
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e6e5e3",
                      backgroundColor: "#ffffff",
                      color: "#37352f",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="materialPassRate"
                    name="자재 합격률"
                    stroke="#217a4f"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="ncrCount"
                    name="NCR 발생"
                    stroke="#c25454"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">기간별 운영 리스크</h2>
              <p className="mt-1 text-sm text-foreground-muted">공정 미조치, 시험 이탈, 인수·준공 미조치 추이를 비교합니다.</p>
            </div>
            <Link href="/qc/handover-inspection" className="text-xs font-medium text-sky-700 hover:underline">
              인수·준공 상세
            </Link>
          </div>
          <div className="mt-3 h-80 w-full">
            {summary.trend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
                {isLoading ? "불러오는 중..." : "추이 데이터가 없습니다."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.trend} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#787774" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#787774" }} />
                  <Tooltip
                    formatter={(value) => `${Number(value ?? 0)}건`}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e6e5e3",
                      backgroundColor: "#ffffff",
                      color: "#37352f",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="processOpenActionCount" name="공정 미조치" fill="#d19c2c" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="testOutOfSpecCount" name="시험 이탈" fill="#c25454" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="handoverPendingCount" name="인수·준공 미조치" fill="#2f76d2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">지연 NCR</h2>
              <p className="mt-1 text-sm text-foreground-muted">기한을 초과한 NCR 우선순위입니다.</p>
            </div>
            <Link href="/qc/nonconformance?overdueOnly=true" className="text-xs font-medium text-sky-700 hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {summary.snapshot.overdueNcrs.length ? (
              summary.snapshot.overdueNcrs.map((item) => (
                <Link
                  key={item._id}
                  href="/qc/nonconformance?overdueOnly=true"
                  className="block rounded-lg border border-border bg-background-soft px-3 py-2 transition hover:bg-background-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{item.ncrNo}</span>
                    <span className="text-xs text-foreground-muted">{item.workType}</span>
                    <span className="text-xs text-rose-700">
                      {QC_NONCONFORMANCE_SEVERITY_LABELS[item.severity as keyof typeof QC_NONCONFORMANCE_SEVERITY_LABELS] ?? "보통"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    담당 {item.assigneeName || "미지정"} · 기한 {formatDate(item.dueDate)}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                지연 NCR이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">미조치 인수·준공 검사</h2>
              <p className="mt-1 text-sm text-foreground-muted">보완 완료 전 또는 승인 대기 상태의 검사입니다.</p>
            </div>
            <Link href="/qc/handover-inspection?unresolvedOnly=true" className="text-xs font-medium text-sky-700 hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {summary.snapshot.pendingHandovers.length ? (
              summary.snapshot.pendingHandovers.map((item) => (
                <Link
                  key={item._id}
                  href="/qc/handover-inspection?unresolvedOnly=true"
                  className="block rounded-lg border border-border bg-background-soft px-3 py-2 transition hover:bg-background-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{item.inspectionNo}</span>
                    <span className="text-xs text-foreground-muted">
                      {QC_HANDOVER_INSPECTION_TYPE_LABELS[item.inspectionType as keyof typeof QC_HANDOVER_INSPECTION_TYPE_LABELS] ??
                        item.inspectionType}
                    </span>
                    <span className="text-xs text-sky-700">
                      {QC_HANDOVER_APPROVAL_STATUS_LABELS[item.approvalStatus as keyof typeof QC_HANDOVER_APPROVAL_STATUS_LABELS] ??
                        item.approvalStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{item.inspectionTitle}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {item.workType} · {item.areaSummary || "영역 미입력"} · 미조치 {item.openFindingCount}건
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                미조치 인수·준공 검사가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">기준치 이탈 시험</h2>
              <p className="mt-1 text-sm text-foreground-muted">최근 기간 부적합 시험 성적서입니다.</p>
            </div>
            <Link href="/qc/test-reports" className="text-xs font-medium text-sky-700 hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {summary.snapshot.failedTests.length ? (
              summary.snapshot.failedTests.map((item) => (
                <Link
                  key={item._id}
                  href="/qc/test-reports"
                  className="block rounded-lg border border-border bg-background-soft px-3 py-2 transition hover:bg-background-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{item.sampleName}</span>
                    <span className="text-xs text-foreground-muted">
                      {QC_TEST_REPORT_TYPE_LABELS[item.testType as keyof typeof QC_TEST_REPORT_TYPE_LABELS] ?? item.testType}
                    </span>
                    <span className="text-xs text-rose-700">이탈 {item.deviationRate.toFixed(1)}%</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{item.summary || item.certificateNo || "시험 결과 요약 없음"}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    시험일 {formatDate(item.testDate)} · 성적서 {item.certificateNo || "-"}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                기준치 이탈 시험이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">공정 미조치</h2>
              <p className="mt-1 text-sm text-foreground-muted">시정조치가 남아 있는 공정 검사입니다.</p>
            </div>
            <Link href="/qc/process-inspection" className="text-xs font-medium text-sky-700 hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {summary.snapshot.openProcessActions.length ? (
              summary.snapshot.openProcessActions.map((item) => (
                <Link
                  key={item._id}
                  href="/qc/process-inspection"
                  className="block rounded-lg border border-border bg-background-soft px-3 py-2 transition hover:bg-background-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{item.inspectionTitle}</span>
                    <span className="text-xs text-foreground-muted">{item.workType}</span>
                    <span className="text-xs text-amber-700">
                      {QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_LABELS[
                        item.correctiveActionStatus as keyof typeof QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_LABELS
                      ] ?? item.correctiveActionStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {item.location || "위치 미입력"} · 예정일 {formatDate(item.plannedInspectionDate)}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                공정 미조치 건이 없습니다.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">공종별 리스크 비교</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              공정 부적합, 미조치, NCR, 인수·준공 보완 건수를 합산한 우선순위입니다.
            </p>
          </div>
          <div className="text-xs text-foreground-muted">리스크 공종 {summary.snapshot.topRiskWorkTypeCount}개</div>
        </div>
        <div className="mt-3">
          <DataTable<QcOpsWorkTypeRiskItem>
            columns={workTypeColumns}
            data={summary.workTypeRisks}
            rowKey={(row) => row.workType}
            emptyMessage={isLoading ? "리스크 데이터를 불러오는 중입니다." : "리스크 공종이 없습니다."}
          />
        </div>
      </section>
    </section>
  );
}

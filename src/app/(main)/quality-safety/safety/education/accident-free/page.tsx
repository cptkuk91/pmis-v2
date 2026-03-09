"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type AccidentFreeRecord = {
  _id: string;
  title: string;
  targetDays: number;
  achievedDays: number;
  startDate: string;
  status: string;
};

type AccidentFreeData = {
  total: number;
  inProgress: number;
  achieved: number;
  failed: number;
  records: AccidentFreeRecord[];
};

const SITE_ID_KEY = "pmis:siteId";
const statusLabel: Record<string, string> = {
  in_progress: "진행중",
  achieved: "달성",
  failed: "미달성",
};

const columns: DataTableColumn<AccidentFreeRecord>[] = [
  { key: "title", header: "제목" },
  { key: "targetDays", header: "목표일수", className: "w-24 text-right" },
  { key: "achievedDays", header: "달성일수", className: "w-24 text-right" },
  {
    key: "startDate",
    header: "시작일",
    className: "w-28",
    render: (_value, row) => row.startDate?.slice(0, 10),
  },
  {
    key: "status",
    header: "상태",
    className: "w-24",
    render: (_value, row) => statusLabel[row.status] ?? row.status,
  },
];

export default function AccidentFreeStatusPage() {
  const [data, setData] = useState<AccidentFreeData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [targetDays, setTargetDays] = useState("");
  const [siteStartDate, setSiteStartDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    const response = await fetch(`/api/safety/accident-free-status?siteId=${siteId}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: AccidentFreeData;
    };

    if (result.ok && result.data) {
      setData(result.data);
    }
  }, []);

  const fetchSiteStartDate = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    const response = await fetch(`/api/sites/${siteId}`, { cache: "no-store" });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { startDate?: string };
    };

    if (result.ok) {
      setSiteStartDate(result.data?.startDate?.slice?.(0, 10) ?? "");
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchSiteStartDate();
  }, [fetchData, fetchSiteStartDate]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const normalizedTitle = title.trim();
    const normalizedTargetDays = Number(targetDays);

    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }

    if (!siteStartDate) {
      setError("현장 시작일이 설정되지 않아 등록할 수 없습니다. 현장 정보에서 시작일을 먼저 설정하세요.");
      return;
    }

    if (!normalizedTitle) {
      setError("제목을 입력하세요.");
      return;
    }

    if (!Number.isFinite(normalizedTargetDays) || normalizedTargetDays <= 0) {
      setError("목표일수는 1 이상이어야 합니다.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/safety/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          rewardType: "accident_free",
          title: normalizedTitle,
          targetDays: normalizedTargetDays,
          startDate: siteStartDate,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(result.error ?? "무재해 목표 등록 실패");
      }

      setTitle("");
      setTargetDays("");
      setShowForm(false);
      await fetchData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "무재해 목표 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">무재해 현황</h1>
        <p className="text-sm text-foreground-muted">데이터를 불러오는 중...</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">무재해 현황</h1>
          <p className="text-sm text-foreground-muted">달성일수는 현장 시작일 기준으로 매일 자동 계산됩니다.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setError(null);
          }}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "목표 등록"}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">제목 *</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">목표일수 *</label>
              <input
                type="number"
                min={1}
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={targetDays}
                onChange={(event) => setTargetDays(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">현장 시작일</label>
              <input
                type="date"
                readOnly
                value={siteStartDate}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </div>
          </div>
          {!siteStartDate ? (
            <p className="text-xs text-red-600">현장 시작일이 설정되지 않아 등록할 수 없습니다. 현장 정보에서 시작일을 먼저 설정하세요.</p>
          ) : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !siteStartDate}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">전체</p>
          <p className="text-2xl font-bold text-foreground">{data.total}건</p>
        </div>
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">진행중</p>
          <p className="text-2xl font-bold text-blue-600">{data.inProgress}건</p>
        </div>
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">달성</p>
          <p className="text-2xl font-bold text-green-600">{data.achieved}건</p>
        </div>
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">미달성</p>
          <p className="text-2xl font-bold text-red-600">{data.failed}건</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data.records}
        rowKey={(row) => row._id}
        emptyMessage="등록된 무재해 목표가 없습니다."
      />
    </section>
  );
}

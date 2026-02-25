"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type Status = "draft" | "in_review" | "approved" | "rejected" | "completed";

type DailySafetyLogRow = {
  _id: string;
  logDate: string;
  weather: string;
  workersCount: number;
  hazards: string;
  actions: string;
  notes: string;
  managerName: string;
  status: Status;
};

type DailySafetyLogResponse = {
  ok: boolean;
  data: DailySafetyLogRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPrintHtml(item: DailySafetyLogRow): string {
  const logDate = new Date(item.logDate).toLocaleDateString("ko-KR");
  const hazards = escapeHtml(item.hazards || "-");
  const actions = escapeHtml(item.actions || "-");
  const notes = escapeHtml(item.notes || "-");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>안전 일지</title>
  <style>
    body { font-family: "Noto Sans KR", "Malgun Gothic", sans-serif; margin: 24px; color: #222; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #cfcfcf; padding: 8px; font-size: 13px; vertical-align: top; }
    th { width: 120px; background: #f4f4f4; text-align: left; }
    .box { min-height: 92px; }
    .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
    .sign { border: 1px solid #cfcfcf; padding: 12px; min-height: 80px; }
    .muted { color: #666; font-size: 12px; margin-top: 12px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>안전 일지</h1>
  <table>
    <tr><th>일자</th><td>${logDate}</td><th>기상</th><td>${escapeHtml(item.weather || "-")}</td></tr>
    <tr><th>근무인원</th><td>${item.workersCount}명</td><th>관리자</th><td>${escapeHtml(item.managerName || "-")}</td></tr>
    <tr><th>상태</th><td colspan="3">${escapeHtml(item.status)}</td></tr>
    <tr><th>위험요인</th><td colspan="3" class="box">${hazards}</td></tr>
    <tr><th>조치사항</th><td colspan="3" class="box">${actions}</td></tr>
    <tr><th>특이사항</th><td colspan="3" class="box">${notes}</td></tr>
  </table>
  <div class="sign-row">
    <div class="sign">안전팀 작성</div>
    <div class="sign">현장소장 확인</div>
  </div>
  <p class="muted">출력시각: ${new Date().toLocaleString("ko-KR")}</p>
</body>
</html>`;
}

export default function SafetyDailyLogPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<DailySafetyLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState("맑음");
  const [workersCount, setWorkersCount] = useState(0);
  const [hazards, setHazards] = useState("");
  const [actions, setActions] = useState("");
  const [notes, setNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          status: statusFilter,
        });

        const response = await fetch(`/api/safety/daily-logs?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as DailySafetyLogResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "안전 일지 조회 실패");
        }

        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "안전 일지 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, statusFilter],
  );

  useEffect(() => {
    void loadData(1);
  }, [loadData]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/safety/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate,
          weather,
          workersCount,
          hazards,
          actions,
          notes,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전 일지 등록 실패");
      }

      setWeather("맑음");
      setWorkersCount(0);
      setHazards("");
      setActions("");
      setNotes("");
      setMessage("안전 일지가 등록되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전 일지 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrint(item: DailySafetyLogRow) {
    const printWindow = window.open("", "_blank", "width=980,height=920");
    if (!printWindow) {
      setError("팝업이 차단되어 인쇄 창을 열 수 없습니다.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(item));
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 150);
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">안전 일지</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          안전팀이 일지를 작성하고 현장소장 확인용으로 보고합니다.
        </p>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => handlePrint(items[0])}
            className="mt-3 rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm text-foreground hover:bg-background-card"
          >
            최신 일지 인쇄
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="기상/위험요인/조치/특이사항"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | Status)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="draft">임시저장</option>
            <option value="in_review">검토중</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="completed">완료</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadData(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canWrite ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-background-soft p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormInput
              label="일지일자"
              type="date"
              value={logDate}
              onChange={(event) => setLogDate(event.target.value)}
              required
            />
            <FormInput
              label="기상"
              value={weather}
              onChange={(event) => setWeather(event.target.value)}
              placeholder="예: 맑음, 흐림"
            />
            <FormInput
              label="근무인원"
              type="number"
              min={0}
              value={String(workersCount)}
              onChange={(event) => setWorkersCount(Number(event.target.value || "0"))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">위험요인</span>
              <textarea
                rows={3}
                value={hazards}
                onChange={(event) => setHazards(event.target.value)}
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">조치사항</span>
              <textarea
                rows={3}
                value={actions}
                onChange={(event) => setActions(event.target.value)}
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">특이사항</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              일지 등록
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">안전 일지 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<DailySafetyLogRow>
        columns={[
          {
            key: "logDate",
            header: "일자",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          { key: "weather", header: "기상", className: "w-16" },
          {
            key: "workersCount",
            header: "인원",
            className: "w-20 text-right",
            render: (value) => `${Number(value)}명`,
          },
          { key: "hazards", header: "위험요인" },
          { key: "actions", header: "조치사항" },
          { key: "notes", header: "특이사항" },
          { key: "managerName", header: "관리자", className: "w-24" },
          {
            key: "status",
            header: "상태",
            className: "w-24",
            render: (value) => <StatusBadge status={value as Status} />,
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 안전 일지가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />
    </section>
  );
}

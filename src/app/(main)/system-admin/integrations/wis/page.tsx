"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, DataTable, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type WisRecord = {
  _id: string;
  workerName: string;
  company: string;
  occupation: string;
  recordDate: string;
  recordType: "attendance" | "safety_education";
  checkInTime?: string | null;
  checkOutTime?: string | null;
  hoursWorked?: number | null;
  educationType?: string | null;
  educationTitle?: string | null;
  educationHours?: number | null;
};

type SyncLog = {
  _id: string;
  status: "pending" | "running" | "success" | "failed";
  recordsProcessed: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string | null;
  retryCount?: number;
  errorMessage?: string | null;
};

type RecordType = "attendance" | "safety_education";

type RecordsResponse = {
  ok: boolean;
  data: WisRecord[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type LogsResponse = {
  ok: boolean;
  data: SyncLog[];
  error?: string;
};

const attendanceColumns = [
  {
    key: "recordDate",
    header: "출역일",
    className: "w-28",
    render: (_value: unknown, row: WisRecord) => row.recordDate?.slice(0, 10),
  },
  { key: "workerName", header: "성명" },
  { key: "company", header: "소속" },
  { key: "occupation", header: "직종" },
  {
    key: "checkInTime",
    header: "출근",
    className: "w-20",
    render: (_value: unknown, row: WisRecord) => row.checkInTime ?? "-",
  },
  {
    key: "checkOutTime",
    header: "퇴근",
    className: "w-20",
    render: (_value: unknown, row: WisRecord) => row.checkOutTime ?? "-",
  },
  {
    key: "hoursWorked",
    header: "근무시간",
    className: "w-24 text-right",
    render: (_value: unknown, row: WisRecord) => String(row.hoursWorked ?? 0),
  },
] as const;

const educationColumns = [
  {
    key: "recordDate",
    header: "교육일",
    className: "w-28",
    render: (_value: unknown, row: WisRecord) => row.recordDate?.slice(0, 10),
  },
  { key: "workerName", header: "교육대상" },
  { key: "company", header: "소속" },
  {
    key: "educationType",
    header: "유형",
    render: (_value: unknown, row: WisRecord) => row.educationType ?? "-",
  },
  {
    key: "educationTitle",
    header: "교육명",
    render: (_value: unknown, row: WisRecord) => row.educationTitle ?? "-",
  },
  {
    key: "educationHours",
    header: "시간",
    className: "w-16 text-right",
    render: (_value: unknown, row: WisRecord) => String(row.educationHours ?? 0),
  },
] as const;

function LogStatusBadge({ status }: { status: SyncLog["status"] }) {
  if (status === "failed") return <Badge tone="danger">실패</Badge>;
  if (status === "running") return <Badge tone="warning">실행중</Badge>;
  if (status === "success") return <Badge tone="success">성공</Badge>;
  return <Badge tone="default">대기</Badge>;
}

export default function WisIntegrationPage() {
  const { user } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [recordType, setRecordType] = useState<RecordType>("attendance");
  const [records, setRecords] = useState<WisRecord[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(
    async (nextPage: number, nextType: RecordType = recordType) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/integrations/wis/records?type=${nextType}&page=${nextPage}&limit=12`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as RecordsResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "WIS 데이터 조회 실패");
        }
        setRecords(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "WIS 데이터 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [recordType],
  );

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/wis/logs?limit=8", { cache: "no-store" });
      const result = (await response.json()) as LogsResponse;
      if (result.ok) {
        setLogs(result.data);
      }
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    void loadRecords(1, recordType);
  }, [recordType, loadRecords]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function triggerSync(mode: "sync" | "retry") {
    if (!canManage) {
      return;
    }

    setIsSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const endpoint =
        mode === "sync"
          ? "/api/integrations/wis/sync"
          : "/api/integrations/wis/retry-failed";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { result?: { processed: number; failed: number }; retried?: number };
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "WIS 동기화 요청 실패");
      }
      if (mode === "sync") {
        const processed = result.data?.result?.processed ?? 0;
        const failed = result.data?.result?.failed ?? 0;
        setMessage(`WIS 동기화 완료: ${processed}건 처리, ${failed}건 실패`);
      } else {
        const retried = result.data?.retried ?? 0;
        setMessage(`WIS 실패 재시도 완료: ${retried}건 실행`);
      }
      await Promise.all([loadRecords(1, recordType), loadLogs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "WIS 동기화 요청 실패");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">WIS 연동</h1>
        <p className="text-sm text-foreground-muted">
          출역현황/안전교육현황 데이터를 동기화하고, 실패 로그 재시도를 관리합니다.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRecordType("attendance")}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              recordType === "attendance"
                ? "border-primary bg-primary text-white"
                : "border-border bg-background-soft text-foreground"
            }`}
          >
            출역 데이터
          </button>
          <button
            type="button"
            onClick={() => setRecordType("safety_education")}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              recordType === "safety_education"
                ? "border-primary bg-primary text-white"
                : "border-border bg-background-soft text-foreground"
            }`}
          >
            안전교육 데이터
          </button>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void triggerSync("sync")}
              className="rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm text-foreground hover:bg-background"
            >
              WIS 동기화
            </button>
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void triggerSync("retry")}
              className="rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm text-foreground hover:bg-background"
            >
              실패 재시도
            </button>
          </div>
        ) : (
          <p className="text-xs text-foreground-muted">동기화 실행은 manager 이상 권한이 필요합니다.</p>
        )}
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable
        columns={recordType === "attendance" ? [...attendanceColumns] : [...educationColumns]}
        data={records}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "동기화된 WIS 데이터가 없습니다."}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadRecords(nextPage)} />

      <section className="space-y-2 rounded-lg border border-border bg-background-soft p-3">
        <h2 className="text-sm font-semibold text-foreground">최근 동기화 로그</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-foreground-muted">동기화 로그가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log._id}
                className="flex flex-col gap-1 rounded-md border border-border bg-background-card p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <LogStatusBadge status={log.status} />
                  <span className="text-foreground-muted">
                    {new Date(log.startedAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <div className="text-foreground-muted">
                  처리 {log.recordsProcessed}건 / 실패 {log.recordsFailed}건 / 재시도{" "}
                  {log.retryCount ?? 0}회
                  {log.errorMessage ? ` (${log.errorMessage})` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

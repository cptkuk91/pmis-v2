"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, FormInput, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type MeetingItem = {
  _id: string;
  category: string;
  agenda: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  host: string;
  minutes?: string;
};

type MeetingResponse = {
  ok: boolean;
  data: MeetingItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR");
}

export default function DashboardMeetingsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = hasMinRole(user.role, "manager");

  const [items, setItems] = useState<MeetingItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState("정기회의");
  const [agenda, setAgenda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadMeetings = useCallback(async (nextPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings?page=${nextPage}&limit=10`, {
        cache: "no-store",
      });
      const result = (await response.json()) as MeetingResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "회의 조회 실패");
      }
      setItems(result.data);
      setPage(result.meta?.page ?? 1);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings(1);
  }, [loadMeetings]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setError(null);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, agenda }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "회의 등록 실패");
      }
      setAgenda("");
      await loadMeetings(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의 등록 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">금일회의</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Phase 2 1팀: 회의개최현황 목록/등록 연동
        </p>
      </header>

      {canManage ? (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_auto]">
          <FormInput
            label="회의구분"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          />
          <FormInput
            label="안건"
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
            required
          />
          <button
            type="submit"
            className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
          >
            등록
          </button>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">회의 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<MeetingItem>
        columns={[
          { key: "category", header: "구분", className: "w-32" },
          { key: "agenda", header: "안건" },
          {
            key: "meetingDate",
            header: "일자",
            className: "w-32",
            render: (value) => formatDate(String(value)),
          },
          {
            key: "startTime",
            header: "시간",
            className: "w-32",
            render: (value, row) => `${String(value)} ~ ${row.endTime}`,
          },
          { key: "location", header: "장소", className: "w-32" },
          { key: "host", header: "주관", className: "w-24" },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "회의 데이터가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadMeetings(nextPage)} />
    </section>
  );
}

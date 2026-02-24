"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ProgressPhotoRow = {
  _id: string;
  title: string;
  shotDate: string;
  location: string;
  description: string;
  progressRate: number;
  uploadedByName: string;
};

type ProgressPhotoResponse = {
  ok: boolean;
  data: ProgressPhotoRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export default function ProgressPhotosPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<ProgressPhotoRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [title, setTitle] = useState("");
  const [shotDate, setShotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [progressRate, setProgressRate] = useState(0);
  const [description, setDescription] = useState("");

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
          limit: "12",
          q: keyword,
        });
        if (fromDate) {
          params.set("from", fromDate);
        }
        if (toDate) {
          params.set("to", toDate);
        }

        const response = await fetch(`/api/progress/photos?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ProgressPhotoResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "진행사진 조회 실패");
        }

        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "진행사진 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [fromDate, keyword, toDate],
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
      const response = await fetch("/api/progress/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          shotDate,
          location,
          progressRate: clampProgress(progressRate),
          description,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "진행사진 등록 실패");
      }

      setTitle("");
      setShotDate(new Date().toISOString().slice(0, 10));
      setLocation("");
      setProgressRate(0);
      setDescription("");
      setMessage("진행사진 메타가 등록되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "진행사진 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">공정진행사진</h1>
        <p className="mt-1 text-sm text-foreground-muted">촬영일/위치/진도율 기반으로 공정 진행사진을 관리합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="제목/위치/설명/등록자"
        />
        <FormInput
          label="촬영일(From)"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <FormInput
          label="촬영일(To)"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormInput
              label="제목"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 4동 외부 마감 진행"
              required
            />
            <FormInput
              label="촬영일"
              type="date"
              value={shotDate}
              onChange={(event) => setShotDate(event.target.value)}
              required
            />
            <FormInput
              label="위치"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="예: 4동 8층"
            />
            <FormInput
              label="진도율(%)"
              type="number"
              min={0}
              max={100}
              value={String(progressRate)}
              onChange={(event) => setProgressRate(Number(event.target.value || "0"))}
            />
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">설명</span>
            <textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              진행사진 등록
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">진행사진 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 6).map((item) => (
          <article key={item._id} className="overflow-hidden rounded-lg border border-border bg-background-soft">
            <div className="h-28 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50" />
            <div className="space-y-1 p-3">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-foreground-muted">
                {new Date(item.shotDate).toLocaleDateString("ko-KR")} · {item.location || "위치 미입력"}
              </p>
              <p className="text-xs text-foreground-muted">진도율 {item.progressRate.toFixed(1)}%</p>
            </div>
          </article>
        ))}
      </div>

      <DataTable<ProgressPhotoRow>
        columns={[
          { key: "title", header: "제목" },
          {
            key: "shotDate",
            header: "촬영일",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          { key: "location", header: "위치", className: "w-32" },
          {
            key: "progressRate",
            header: "진도율",
            className: "w-20 text-right",
            render: (value) => `${Number(value).toFixed(1)}%`,
          },
          { key: "uploadedByName", header: "등록자", className: "w-24" },
          { key: "description", header: "설명" },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 진행사진이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />
    </section>
  );
}

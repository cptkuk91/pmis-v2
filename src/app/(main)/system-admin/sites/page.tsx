"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type SiteRow = {
  _id: string;
  siteCode: string;
  siteName: string;
  address?: string;
  status: "active" | "completed" | "suspended";
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
};

type SitesResponse = {
  ok: boolean;
  data: SiteRow[];
  error?: string;
};

export default function SiteManagementPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "super_admin"), [user.role]);
  const [items, setItems] = useState<SiteRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    siteCode: "",
    siteName: "",
    address: "",
    status: "active" as SiteRow["status"],
    startDate: "",
    endDate: "",
    description: "",
  });

  const loadSites = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sites", { cache: "no-store" });
      const result = (await response.json()) as SitesResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장 목록 조회 실패");
      }
      setItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 목록 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isUserLoading) {
      void loadSites();
    }
  }, [isUserLoading, loadSites]);

  async function handleCreateSite() {
    if (!canManage) {
      setError("현장 생성 권한이 없습니다.");
      return;
    }

    if (!form.siteCode.trim() || !form.siteName.trim()) {
      setError("현장코드와 현장명은 필수입니다.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteCode: form.siteCode.trim().toUpperCase(),
          siteName: form.siteName.trim(),
          address: form.address.trim(),
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          description: form.description.trim(),
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "현장 생성 실패");
      }

      setForm({
        siteCode: "",
        siteName: "",
        address: "",
        status: "active",
        startDate: "",
        endDate: "",
        description: "",
      });
      setMessage("현장이 생성되었습니다. 상단 현장 전환에서 선택할 수 있습니다.");
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 생성 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">현장 등록/관리</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          최고 관리자 권한으로 신규 현장을 생성하고 상태를 관리합니다.
        </p>
      </header>

      {!canManage ? (
        <div className="rounded-md border border-border bg-background-soft p-3 text-sm text-foreground-muted">
          현재 계정은 현장 생성 권한(`super_admin`)이 없습니다.
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-border bg-background-soft p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">현장코드 *</span>
              <input
                value={form.siteCode}
                onChange={(event) => setForm((prev) => ({ ...prev, siteCode: event.target.value }))}
                placeholder="예: PMIS-SITE-001"
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">현장명 *</span>
              <input
                value={form.siteName}
                onChange={(event) => setForm((prev) => ({ ...prev, siteName: event.target.value }))}
                placeholder="예: 로얄팰리스"
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">주소</span>
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as SiteRow["status"] }))
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="active">진행중</option>
                <option value="completed">완료</option>
                <option value="suspended">중지</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">착공일</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">준공일</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">설명</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleCreateSite()}
              className="rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-60"
            >
              현장 생성
            </button>
          </div>
        </div>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-background-soft text-left text-foreground-muted">
            <tr>
              <th className="px-3 py-2">현장코드</th>
              <th className="px-3 py-2">현장명</th>
              <th className="px-3 py-2">주소</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-3 py-3 text-foreground-muted" colSpan={4}>
                  현장 목록 로딩 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-foreground-muted" colSpan={4}>
                  등록된 현장이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{item.siteCode}</td>
                  <td className="px-3 py-2 text-foreground">{item.siteName}</td>
                  <td className="px-3 py-2 text-foreground-muted">{item.address || "-"}</td>
                  <td className="px-3 py-2 text-foreground-muted">{item.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

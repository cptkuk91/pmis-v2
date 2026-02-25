"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type SiteData = {
  _id: string;
  siteCode: string;
  siteName: string;
  address: string;
  status: string;
  startDate: string;
  endDate: string;
  description: string;
  projectManager?: { name: string; email: string };
};

type HistoryRow = {
  _id: string;
  eventDate: string;
  title: string;
  description: string;
  category: string;
};

const SITE_ID_KEY = "pmis:siteId";

function getSiteId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SITE_ID_KEY) ?? "";
}

const historyColumns: DataTableColumn<HistoryRow>[] = [
  {
    key: "eventDate",
    header: "일자",
    className: "w-28",
    render: (v) => (v ? new Date(v as string).toLocaleDateString("ko-KR") : "-"),
  },
  { key: "category", header: "구분", className: "w-24" },
  { key: "title", header: "제목" },
  { key: "description", header: "내용" },
];

export default function OverviewPage() {
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(getSiteId()));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ siteName: "", address: "", description: "" });

  /* history */
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [showHistForm, setShowHistForm] = useState(false);
  const [histForm, setHistForm] = useState({ eventDate: "", title: "", description: "", category: "" });

  useEffect(() => {
    const siteId = getSiteId();
    if (!siteId) return;
    fetch(`/api/sites/${siteId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setSite(res.data);
          setForm({
            siteName: res.data.siteName,
            address: res.data.address ?? "",
            description: res.data.description ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchHistory = useCallback((p: number) => {
    const siteId = getSiteId();
    if (!siteId) return;
    fetch(`/api/sites/history?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setHistory(res.data);
          setHistTotalPages(res.meta?.totalPages ?? 1);
        }
      });
  }, []);

  useEffect(() => { fetchHistory(histPage); }, [histPage, fetchHistory]);

  async function handleSave() {
    const siteId = getSiteId();
    const res = await fetch(`/api/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.ok) {
      setSite(json.data);
      setEditing(false);
    }
  }

  async function handleHistSubmit() {
    const siteId = getSiteId();
    const res = await fetch("/api/sites/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...histForm, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowHistForm(false);
      setHistForm({ eventDate: "", title: "", description: "", category: "" });
      fetchHistory(1);
      setHistPage(1);
    }
  }

  if (loading) return <div className="p-6 text-sm text-foreground-muted">로딩 중...</div>;
  if (!site) return <div className="p-6 text-sm text-foreground-muted">현장을 선택해주세요.</div>;

  return (
    <section className="space-y-6">
      {/* ── 현장 개요 ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">현장 개요</h1>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
          >
            수정
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background-card p-6">
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">현장명</label>
              <input
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">주소</label>
              <input
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">설명</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-background-card p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-background-soft"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm text-foreground-muted">현장코드</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.siteCode}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">현장명</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.siteName}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">주소</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.address || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">상태</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">착공일</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {site.startDate ? new Date(site.startDate).toLocaleDateString("ko-KR") : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">준공일</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {site.endDate ? new Date(site.endDate).toLocaleDateString("ko-KR") : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">현장소장</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {site.projectManager?.name ?? "-"}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-sm text-foreground-muted">설명</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.description || "-"}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* ── 프로젝트 연혁 ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">프로젝트 연혁</h2>
        <button
          type="button"
          onClick={() => setShowHistForm(!showHistForm)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showHistForm ? "취소" : "등록"}
        </button>
      </div>

      {showHistForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">일자</label>
              <input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={histForm.eventDate} onChange={(e) => setHistForm({ ...histForm, eventDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={histForm.category} onChange={(e) => setHistForm({ ...histForm, category: e.target.value })} placeholder="착공, 준공, 인허가 등" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">제목</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={histForm.title} onChange={(e) => setHistForm({ ...histForm, title: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">내용</label>
            <textarea className="min-h-20 w-full rounded-md border border-border p-3 text-sm" value={histForm.description} onChange={(e) => setHistForm({ ...histForm, description: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleHistSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button>
          </div>
        </div>
      )}

      <DataTable columns={historyColumns} data={history} rowKey={(row) => row._id} />
      {histTotalPages > 1 && <Pagination page={histPage} totalPages={histTotalPages} onPageChange={setHistPage} />}
    </section>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

/* ── types ── */
type PlanRow = { _id: string; title: string; category: string; description: string; version: string; createdAt: string };
type SpecRow = { _id: string; title: string; category: string; description: string; version: string; effectiveDate: string; createdAt: string };
type MethodRow = { _id: string; title: string; workType: string; description: string; createdAt: string };

const SITE_ID_KEY = "pmis:siteId";

const tabs = [
  { key: "plans", label: "시공계획" },
  { key: "specs", label: "시방서" },
  { key: "methods", label: "주요공법" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

const dateKR = (v: unknown) => (v ? new Date(v as string).toLocaleDateString("ko-KR") : "-");

/* ── columns per tab ── */
const planColumns: DataTableColumn<PlanRow>[] = [
  { key: "title", header: "제목" },
  { key: "category", header: "구분", className: "w-24" },
  { key: "version", header: "버전", className: "w-20" },
  { key: "description", header: "설명" },
  { key: "createdAt", header: "등록일", className: "w-28", render: (v) => dateKR(v) },
];

const specColumns: DataTableColumn<SpecRow>[] = [
  { key: "title", header: "제목" },
  { key: "category", header: "구분", className: "w-24" },
  { key: "version", header: "버전", className: "w-20" },
  { key: "effectiveDate", header: "적용일", className: "w-28", render: (v) => dateKR(v) },
  { key: "createdAt", header: "등록일", className: "w-28", render: (v) => dateKR(v) },
];

const methodColumns: DataTableColumn<MethodRow>[] = [
  { key: "title", header: "공법명" },
  { key: "workType", header: "공종", className: "w-24" },
  { key: "description", header: "설명" },
  { key: "createdAt", header: "등록일", className: "w-28", render: (v) => dateKR(v) },
];

/* ── API paths ── */
const apiPath: Record<TabKey, string> = {
  plans: "/api/sites/construction-plans",
  specs: "/api/sites/specifications",
  methods: "/api/sites/methods",
};

/* ── form defaults ── */
const defaultForms = {
  plans: { title: "", category: "", description: "", version: "" },
  specs: { title: "", category: "", description: "", version: "", effectiveDate: "" },
  methods: { title: "", workType: "", description: "" },
};

export default function TechnicalDocsPage() {
  const [tab, setTab] = useState<TabKey>("plans");
  const [data, setData] = useState<unknown[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const [planForm, setPlanForm] = useState(defaultForms.plans);
  const [specForm, setSpecForm] = useState(defaultForms.specs);
  const [methodForm, setMethodForm] = useState(defaultForms.methods);

  const fetchData = useCallback((p: number, t: TabKey) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`${apiPath[t]}?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page, tab); }, [page, tab, fetchData]);

  function handleTabChange(key: TabKey) {
    setTab(key);
    setPage(1);
    setShowForm(false);
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const body = tab === "plans" ? planForm : tab === "specs" ? specForm : methodForm;
    const res = await fetch(apiPath[tab], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      if (tab === "plans") setPlanForm(defaultForms.plans);
      else if (tab === "specs") setSpecForm(defaultForms.specs);
      else setMethodForm(defaultForms.methods);
      fetchData(1, tab);
      setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">기술 문서</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === t.key ? "bg-[#ecebe8] font-medium text-foreground" : "text-foreground-muted hover:bg-background-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* forms */}
      {showForm && tab === "plans" && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">구분</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={planForm.category} onChange={(e) => setPlanForm({ ...planForm, category: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">버전</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={planForm.version} onChange={(e) => setPlanForm({ ...planForm, version: e.target.value })} placeholder="v1.0" /></div>
          </div>
          <div className="space-y-1"><label className="block text-sm font-medium text-foreground">설명</label><textarea className="min-h-20 w-full rounded-md border border-border p-3 text-sm" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      {showForm && tab === "specs" && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={specForm.title} onChange={(e) => setSpecForm({ ...specForm, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">구분</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={specForm.category} onChange={(e) => setSpecForm({ ...specForm, category: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">버전</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={specForm.version} onChange={(e) => setSpecForm({ ...specForm, version: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">적용일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={specForm.effectiveDate} onChange={(e) => setSpecForm({ ...specForm, effectiveDate: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><label className="block text-sm font-medium text-foreground">설명</label><textarea className="min-h-20 w-full rounded-md border border-border p-3 text-sm" value={specForm.description} onChange={(e) => setSpecForm({ ...specForm, description: e.target.value })} /></div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      {showForm && tab === "methods" && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">공법명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={methodForm.title} onChange={(e) => setMethodForm({ ...methodForm, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">공종</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={methodForm.workType} onChange={(e) => setMethodForm({ ...methodForm, workType: e.target.value })} placeholder="토목, 건축, 기전 등" /></div>
          </div>
          <div className="space-y-1"><label className="block text-sm font-medium text-foreground">설명</label><textarea className="min-h-20 w-full rounded-md border border-border p-3 text-sm" value={methodForm.description} onChange={(e) => setMethodForm({ ...methodForm, description: e.target.value })} /></div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      {/* table */}
      {tab === "plans" && <DataTable columns={planColumns} data={data as PlanRow[]} rowKey={(row) => row._id} />}
      {tab === "specs" && <DataTable columns={specColumns} data={data as SpecRow[]} rowKey={(row) => row._id} />}
      {tab === "methods" && <DataTable columns={methodColumns} data={data as MethodRow[]} rowKey={(row) => row._id} />}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

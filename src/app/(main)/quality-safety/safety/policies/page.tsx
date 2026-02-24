"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type PolicyRow = { _id: string; policyType: string; title: string; content: string; effectiveDate: string; version: number };
const SITE_ID_KEY = "pmis:siteId";
const typeLabel: Record<string, string> = { headquarters: "본사", site: "현장" };
const columns: DataTableColumn<PolicyRow>[] = [
  { key: "policyType", header: "구분", className: "w-20", render: (_v, row) => typeLabel[row.policyType] ?? row.policyType },
  { key: "title", header: "제목" },
  { key: "content", header: "내용", render: (_v, row) => row.content?.slice(0, 50) },
  { key: "effectiveDate", header: "시행일", className: "w-28", render: (_v, row) => row.effectiveDate?.slice(0, 10) },
  { key: "version", header: "버전", className: "w-16" },
];

export default function SafetyPoliciesPage() {
  const [data, setData] = useState<PolicyRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ policyType: "site", title: "", content: "", effectiveDate: "" });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/policies?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); } });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/safety/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, siteId }) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ policyType: "site", title: "", content: "", effectiveDate: "" }); fetchData(1); setPage(1); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">본사/현장 안전방침</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">구분</label><select className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.policyType} onChange={(e) => setForm({ ...form, policyType: e.target.value })}><option value="headquarters">본사</option><option value="site">현장</option></select></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">시행일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-3"><label className="block text-sm font-medium text-foreground">내용</label><textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

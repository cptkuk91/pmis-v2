"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type DocRow = { _id: string; title: string; description: string; status: string; version: number };
const SITE_ID_KEY = "pmis:siteId";
const statusLabel: Record<string, string> = { draft: "초안", in_review: "검토중", approved: "승인", rejected: "반려" };
const columns: DataTableColumn<DocRow>[] = [
  { key: "title", header: "제목" },
  { key: "description", header: "설명", render: (_v, row) => row.description?.slice(0, 40) },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
  { key: "version", header: "버전", className: "w-16" },
];

export default function HazardStandardsPage() {
  const [data, setData] = useState<DocRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/standards?siteId=${siteId}&docType=hazard&page=${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); } });
  }, []);
  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/safety/standards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, siteId, docType: "hazard" }) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ title: "", description: "" }); fetchData(1); setPage(1); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">유해위험방지계획서</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-2"><label className="block text-sm font-medium text-foreground">설명</label><textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

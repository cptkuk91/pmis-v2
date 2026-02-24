"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type MethodRow = {
  _id: string;
  title: string;
  workType: string;
  description: string;
  createdAt: string;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<MethodRow>[] = [
  { key: "title", header: "공법명" },
  { key: "workType", header: "공종", className: "w-24" },
  { key: "description", header: "설명" },
  {
    key: "createdAt",
    header: "등록일",
    className: "w-28",
    render: (v) => new Date(v as string).toLocaleDateString("ko-KR"),
  },
];

export default function MethodsPage() {
  const [data, setData] = useState<MethodRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", workType: "", description: "" });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/sites/methods?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setData(res.data);
          setTotalPages(res.meta?.totalPages ?? 1);
        }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/sites/methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ title: "", workType: "", description: "" });
      fetchData(1);
      setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">주요공법</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">공법명 *</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">공종</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })} placeholder="토목, 건축, 기전 등" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">설명</label>
            <textarea className="min-h-20 w-full rounded-md border border-border p-3 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type HistoryRow = {
  _id: string;
  eventDate: string;
  title: string;
  description: string;
  category: string;
};

const SITE_ID_KEY = "pmis:siteId";
const columns: DataTableColumn<HistoryRow>[] = [
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

export default function HistoryPage() {
  const [data, setData] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ eventDate: "", title: "", description: "", category: "" });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/sites/history?siteId=${siteId}&page=${p}`)
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
    const res = await fetch("/api/sites/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ eventDate: "", title: "", description: "", category: "" });
      fetchData(1);
      setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">사업연혁</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">일자</label>
              <input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="착공, 준공, 인허가 등" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">제목</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">내용</label>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type Row = {
  _id: string;
  managerName: string;
  category: string;
  points: number;
  recordDate: string;
  description: string;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<Row>[] = [
  { key: "managerName", header: "소장명" },
  { key: "category", header: "분류" },
  { key: "points", header: "점수", className: "w-20 text-right", render: (_v, row) => row.points?.toLocaleString() },
  { key: "recordDate", header: "기록일", className: "w-28", render: (_v, row) => row.recordDate?.slice(0, 10) },
  { key: "description", header: "설명" },
];

export default function MileageRewardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ managerName: "", category: "", points: "", recordDate: "", description: "" });

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/mileage?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setRows(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const body = { ...form, points: Number(form.points) || 0, siteId };
    const res = await fetch("/api/safety/mileage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ managerName: "", category: "", points: "", recordDate: "", description: "" }); fetchData(); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">현장소장 마일리지</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">소장명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">분류 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">점수</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">기록일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">설명</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      <DataTable columns={columns} data={rows} rowKey={(row) => row._id} />
    </section>
  );
}

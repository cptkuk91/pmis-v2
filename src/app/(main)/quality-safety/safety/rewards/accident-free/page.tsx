"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type Row = {
  _id: string;
  title: string;
  targetDays: number;
  achievedDays: number;
  startDate: string;
  status: string;
};

const SITE_ID_KEY = "pmis:siteId";
const statusLabel: Record<string, string> = { in_progress: "진행중", achieved: "달성", failed: "미달성" };

const columns: DataTableColumn<Row>[] = [
  { key: "title", header: "제목" },
  { key: "targetDays", header: "목표일수", className: "w-24" },
  { key: "achievedDays", header: "달성일수", className: "w-24" },
  { key: "startDate", header: "시작일", className: "w-28", render: (_v, row) => row.startDate?.slice(0, 10) },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
];

export default function AccidentFreeRewardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", targetDays: "", startDate: "" });

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/rewards?rewardType=accident_free&siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setRows(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const body = { ...form, targetDays: Number(form.targetDays) || 0, rewardType: "accident_free", siteId };
    const res = await fetch("/api/safety/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ title: "", targetDays: "", startDate: "" }); fetchData(); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">무재해목표달성</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">목표일수 *</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.targetDays} onChange={(e) => setForm({ ...form, targetDays: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">시작일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      <DataTable columns={columns} data={rows} rowKey={(row) => row._id} />
    </section>
  );
}

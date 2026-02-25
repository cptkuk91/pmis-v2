"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type Row = {
  _id: string;
  reportType: string;
  title: string;
  reportDate: string;
  content: string;
  amount: number;
  remarks: string;
};

const SITE_ID_KEY = "pmis:siteId";
const typeLabel: Record<string, string> = { situation: "상황 보고", cost: "운영비" };

const columns: DataTableColumn<Row>[] = [
  { key: "reportType", header: "유형", className: "w-24", render: (_v, row) => typeLabel[row.reportType] ?? row.reportType },
  { key: "title", header: "제목" },
  { key: "reportDate", header: "보고일", className: "w-28", render: (_v, row) => row.reportDate?.slice(0, 10) },
  { key: "amount", header: "금액", className: "w-28 text-right", render: (_v, row) => row.amount?.toLocaleString() },
  { key: "remarks", header: "비고" },
];

export default function SafetyManagementOngoingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reportType: "situation", title: "", reportDate: "", amount: "", content: "" });

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/reports?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setRows(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const body = { ...form, amount: Number(form.amount) || 0, siteId };
    const res = await fetch("/api/safety/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ reportType: "situation", title: "", reportDate: "", amount: "", content: "" }); fetchData(); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">운영 리포트 (상황 보고/운영비)</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">유형 *</label>
              <select className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })}>
                <option value="situation">상황 보고</option>
                <option value="cost">운영비</option>
              </select>
            </div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">보고일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.reportDate} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">금액</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><label className="block text-sm font-medium text-foreground">내용</label><textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      <DataTable columns={columns} data={rows} rowKey={(row) => row._id} />
    </section>
  );
}

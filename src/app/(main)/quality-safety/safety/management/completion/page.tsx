"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type Row = {
  _id: string;
  accidentDate: string;
  accidentType: string;
  location: string;
  description: string;
  injuredName: string;
  injuredCompany: string;
  severity: string;
  actionTaken: string;
  status: string;
};

const SITE_ID_KEY = "pmis:siteId";
const severityLabel: Record<string, string> = { minor: "경미", moderate: "보통", serious: "중대", fatal: "사망" };
const statusLabel: Record<string, string> = { open: "진행", closed: "종결", pending: "대기" };

const columns: DataTableColumn<Row>[] = [
  { key: "accidentDate", header: "일자", className: "w-28", render: (_v, row) => row.accidentDate?.slice(0, 10) },
  { key: "accidentType", header: "유형" },
  { key: "location", header: "장소" },
  { key: "injuredName", header: "피해자" },
  { key: "severity", header: "심각도", className: "w-20", render: (_v, row) => severityLabel[row.severity] ?? row.severity },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
];

export default function SafetyManagementCompletionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ accidentType: "", accidentDate: "", location: "", injuredName: "", injuredCompany: "", severity: "minor", description: "" });

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/completion?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setRows(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const body = { ...form, siteId };
    const res = await fetch("/api/safety/completion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ accidentType: "", accidentDate: "", location: "", injuredName: "", injuredCompany: "", severity: "minor", description: "" }); fetchData(); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">준공시 안전업무</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">유형 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.accidentType} onChange={(e) => setForm({ ...form, accidentType: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">일자</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.accidentDate} onChange={(e) => setForm({ ...form, accidentDate: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">장소</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">피해자</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.injuredName} onChange={(e) => setForm({ ...form, injuredName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">소속</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.injuredCompany} onChange={(e) => setForm({ ...form, injuredCompany: e.target.value })} /></div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">심각도</label>
              <select className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="minor">경미</option>
                <option value="moderate">보통</option>
                <option value="serious">중대</option>
                <option value="fatal">사망</option>
              </select>
            </div>
          </div>
          <div className="space-y-1"><label className="block text-sm font-medium text-foreground">내용</label><textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      <DataTable columns={columns} data={rows} rowKey={(row) => row._id} />
    </section>
  );
}

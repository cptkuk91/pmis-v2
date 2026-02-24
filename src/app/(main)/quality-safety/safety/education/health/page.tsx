"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type HealthRow = { _id: string; workerName: string; company: string; checkType: string; checkDate: string; result: string; hospital: string };
const SITE_ID_KEY = "pmis:siteId";
const checkTypeLabel: Record<string, string> = { regular: "정기", special: "특수", hiring: "채용" };
const resultLabel: Record<string, string> = { normal: "정상", observation: "관찰", abnormal: "이상" };
const columns: DataTableColumn<HealthRow>[] = [
  { key: "workerName", header: "성명" },
  { key: "company", header: "소속" },
  { key: "checkType", header: "구분", className: "w-20", render: (_v, row) => checkTypeLabel[row.checkType] ?? row.checkType },
  { key: "checkDate", header: "검진일", className: "w-28", render: (_v, row) => row.checkDate?.slice(0, 10) },
  { key: "result", header: "결과", className: "w-20", render: (_v, row) => resultLabel[row.result] ?? row.result },
  { key: "hospital", header: "병원" },
];

export default function SafetyHealthPage() {
  const [data, setData] = useState<HealthRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ workerName: "", company: "", checkType: "regular", checkDate: "", result: "normal", hospital: "" });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/health?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); } });
  }, []);
  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/safety/health", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, siteId }) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ workerName: "", company: "", checkType: "regular", checkDate: "", result: "normal", hospital: "" }); fetchData(1); setPage(1); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">건강검진</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">성명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.workerName} onChange={(e) => setForm({ ...form, workerName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">소속</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분 *</label>
              <select className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.checkType} onChange={(e) => setForm({ ...form, checkType: e.target.value })}>
                <option value="regular">정기</option>
                <option value="special">특수</option>
                <option value="hiring">채용</option>
              </select>
            </div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">검진일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.checkDate} onChange={(e) => setForm({ ...form, checkDate: e.target.value })} /></div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">결과 *</label>
              <select className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                <option value="normal">정상</option>
                <option value="observation">관찰</option>
                <option value="abnormal">이상</option>
              </select>
            </div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">병원</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

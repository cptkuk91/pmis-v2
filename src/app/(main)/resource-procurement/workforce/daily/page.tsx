"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type AttendanceRow = {
  _id: string;
  attendanceDate: string;
  workerName: string;
  company: string;
  jobType: string;
  workType: string;
  isPresent: boolean;
  hoursWorked: number;
  overtimeHours: number;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<AttendanceRow>[] = [
  { key: "attendanceDate", header: "출역일", className: "w-28", render: (_v, row) => row.attendanceDate?.slice(0, 10) },
  { key: "workerName", header: "성명" },
  { key: "company", header: "소속" },
  { key: "jobType", header: "직종" },
  { key: "workType", header: "공종" },
  { key: "isPresent", header: "출석", className: "w-16", render: (_v, row) => (row.isPresent ? "O" : "X") },
  { key: "hoursWorked", header: "근무시간", className: "w-24 text-right" },
  { key: "overtimeHours", header: "잔업", className: "w-20 text-right" },
];

export default function WorkforceDailyPage() {
  const [data, setData] = useState<AttendanceRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [form, setForm] = useState({
    workerName: "", company: "", jobType: "", workType: "", attendanceDate: "",
    isPresent: true, hoursWorked: 8, overtimeHours: 0,
  });

  const fetchData = useCallback((p: number, d: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/workforce/daily?siteId=${siteId}&date=${d}&page=${p}&limit=50`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page, date); }, [page, date, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/resource/workforce/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId, attendanceDate: form.attendanceDate || date }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ workerName: "", company: "", jobType: "", workType: "", attendanceDate: "", isPresent: true, hoursWorked: 8, overtimeHours: 0 });
      fetchData(1, date); setPage(1);
    }
  }

  async function handleWisSync() {
    setSyncMessage(null);
    setSyncError(null);
    try {
      const response = await fetch("/api/integrations/wis/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error ?? "WIS 동기화 실패");
      }
      setSyncMessage("WIS 출역 데이터 동기화를 완료했습니다.");
      fetchData(1, date);
      setPage(1);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "WIS 동기화 실패");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold text-foreground">일일 근태</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" className="h-9 rounded-md border border-border px-3 text-sm" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
          <button type="button" onClick={() => void handleWisSync()} className="rounded-md border border-border bg-background-soft px-4 py-1.5 text-sm font-medium text-foreground hover:bg-background-card">
            WIS 동기화
          </button>
          <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
            {showForm ? "취소" : "등록"}
          </button>
        </div>
      </div>
      {syncMessage ? <p className="text-sm text-success">{syncMessage}</p> : null}
      {syncError ? <p className="text-sm text-danger">{syncError}</p> : null}
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">성명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.workerName} onChange={(e) => setForm({ ...form, workerName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">소속</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">직종</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">공종</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">근무시간</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: Number(e.target.value) })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">잔업시간</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: Number(e.target.value) })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

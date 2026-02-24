"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type TrainingRow = { _id: string; educationType: string; title: string; educationDate: string; instructor: string; duration: number; attendeeCount: number; content: string };
const SITE_ID_KEY = "pmis:siteId";
const columns: DataTableColumn<TrainingRow>[] = [
  { key: "educationType", header: "유형" },
  { key: "title", header: "제목" },
  { key: "educationDate", header: "교육일", className: "w-28", render: (_v, row) => row.educationDate?.slice(0, 10) },
  { key: "instructor", header: "강사" },
  { key: "duration", header: "시간", className: "w-16" },
  { key: "attendeeCount", header: "참석", className: "w-16" },
];

export default function SafetyTrainingPage() {
  const [data, setData] = useState<TrainingRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [form, setForm] = useState({ educationType: "", title: "", educationDate: "", instructor: "", duration: "", attendeeCount: "", content: "" });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/education?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); } });
  }, []);
  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/safety/education", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, siteId, duration: Number(form.duration), attendeeCount: Number(form.attendeeCount) }) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ educationType: "", title: "", educationDate: "", instructor: "", duration: "", attendeeCount: "", content: "" }); fetchData(1); setPage(1); }
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
      setSyncMessage("WIS 안전교육 데이터 동기화를 완료했습니다.");
      fetchData(1);
      setPage(1);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "WIS 동기화 실패");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold text-foreground">안전교육</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleWisSync()} className="rounded-md border border-border bg-background-soft px-4 py-1.5 text-sm font-medium text-foreground hover:bg-background-card">WIS 동기화</button>
          <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
        </div>
      </div>
      {syncMessage ? <p className="text-sm text-success">{syncMessage}</p> : null}
      {syncError ? <p className="text-sm text-danger">{syncError}</p> : null}
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">유형 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.educationType} onChange={(e) => setForm({ ...form, educationType: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">교육일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.educationDate} onChange={(e) => setForm({ ...form, educationDate: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">강사</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">시간</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">참석인원</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.attendeeCount} onChange={(e) => setForm({ ...form, attendeeCount: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><label className="block text-sm font-medium text-foreground">내용</label><textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

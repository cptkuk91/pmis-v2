"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  DEFAULT_SAFETY_TRAINING_TYPE,
  SAFETY_TRAINING_TYPES,
  type SafetyTrainingType,
} from "@/lib/safety-training-type";

type TrainingRow = { _id: string; educationType: SafetyTrainingType; title: string; educationDate: string; instructor: string; duration: number; attendeeCount: number; content: string };
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
  const [form, setForm] = useState({
    educationType: DEFAULT_SAFETY_TRAINING_TYPE,
    title: "",
    educationDate: "",
    instructor: "",
    duration: "",
    attendeeCount: "",
    content: "",
  });

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
    if (json.ok) {
      setShowForm(false);
      setForm({
        educationType: DEFAULT_SAFETY_TRAINING_TYPE,
        title: "",
        educationDate: "",
        instructor: "",
        duration: "",
        attendeeCount: "",
        content: "",
      });
      fetchData(1);
      setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">안전교육</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">유형 *</label>
              <select
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.educationType}
                onChange={(e) =>
                  setForm({ ...form, educationType: e.target.value as SafetyTrainingType })
                }
              >
                {SAFETY_TRAINING_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type InspectionRow = {
  _id: string;
  materialName: string;
  quantity: number;
  unit: string;
  inspectionDate: string;
  result: string;
  inspector: string;
  remarks: string;
};

const SITE_ID_KEY = "pmis:siteId";

const resultLabel: Record<string, string> = { pending: "대기", pass: "합격", fail: "불합격" };

const columns: DataTableColumn<InspectionRow>[] = [
  { key: "materialName", header: "자재명" },
  { key: "quantity", header: "수량", className: "w-20 text-right" },
  { key: "unit", header: "단위", className: "w-16" },
  { key: "inspectionDate", header: "검수일", className: "w-28", render: (_v, row) => row.inspectionDate?.slice(0, 10) },
  { key: "result", header: "결과", className: "w-20", render: (_v, row) => resultLabel[row.result] ?? row.result },
  { key: "inspector", header: "검수자" },
  { key: "remarks", header: "비고" },
];

const tabs = [
  { key: "", label: "전체" },
  { key: "pending", label: "대기" },
  { key: "pass", label: "합격" },
  { key: "fail", label: "불합격" },
] as const;

export default function QcMaterialInspectionPage() {
  const [data, setData] = useState<InspectionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resultFilter, setResultFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    materialName: "", quantity: 0, unit: "", inspectionDate: "", result: "pending", inspector: "", remarks: "",
  });

  const fetchData = useCallback((p: number, result: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    const url = `/api/qc/material-inspections?siteId=${siteId}&page=${p}${result ? `&result=${result}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page, resultFilter); }, [page, resultFilter, fetchData]);

  function handleTabChange(key: string) {
    setResultFilter(key);
    setPage(1);
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/qc/material-inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ materialName: "", quantity: 0, unit: "", inspectionDate: "", result: "pending", inspector: "", remarks: "" });
      setPage(1);
      fetchData(1, resultFilter);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">자재 검사</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">자재명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.materialName} onChange={(e) => setForm({ ...form, materialName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">수량</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">단위</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">검수일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.inspectionDate} onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">결과</label>
              <select className="h-9 w-full rounded-md border border-border px-2 text-sm" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                <option value="pending">대기</option><option value="pass">합격</option><option value="fail">불합격</option>
              </select>
            </div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">검수자</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-3"><label className="block text-sm font-medium text-foreground">비고</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${resultFilter === t.key ? "bg-[#ecebe8] font-medium text-foreground" : "text-foreground-muted hover:bg-background-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

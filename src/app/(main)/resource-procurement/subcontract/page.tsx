"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type ReviewRow = {
  _id: string;
  title: string;
  contractorName: string;
  workType: string;
  contractAmount: number;
  status: string;
  requestDate: string;
};

type ReviewItem = { checkItem: string; result: string; remarks: string };

const SITE_ID_KEY = "pmis:siteId";

const statusLabel: Record<string, string> = { pending: "대기", approved: "승인", rejected: "반려" };

const columns: DataTableColumn<ReviewRow>[] = [
  { key: "title", header: "제목" },
  { key: "contractorName", header: "업체명" },
  { key: "workType", header: "공종" },
  { key: "contractAmount", header: "계약금액", className: "w-32 text-right", render: (_v, row) => row.contractAmount?.toLocaleString() },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
  { key: "requestDate", header: "요청일", className: "w-28", render: (_v, row) => row.requestDate?.slice(0, 10) },
];

const statusTabs = [
  { key: "", label: "전체" },
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
] as const;

export default function SubcontractPage() {
  const [data, setData] = useState<ReviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    title: "", contractorName: "", workType: "", contractAmount: 0, remarks: "",
  });
  const [items, setItems] = useState<ReviewItem[]>([
    { checkItem: "", result: "na", remarks: "" },
  ]);

  const fetchData = useCallback((p: number, status: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    const url = `/api/subcontract-reviews?siteId=${siteId}&page=${p}${status ? `&status=${status}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page, statusFilter); }, [page, statusFilter, fetchData]);

  function handleTabChange(key: string) {
    setStatusFilter(key);
    setPage(1);
  }

  function addItem() {
    setItems([...items, { checkItem: "", result: "na", remarks: "" }]);
  }

  function updateItem(idx: number, field: keyof ReviewItem, value: string) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/subcontract-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId, items }),
    });
    const json = await res.json();
    if (json.ok) {
      setSubmitted(true);
      setShowForm(false);
      setForm({ title: "", contractorName: "", workType: "", contractAmount: 0, remarks: "" });
      setItems([{ checkItem: "", result: "na", remarks: "" }]);
      setPage(1);
      fetchData(1, statusFilter);
      setTimeout(() => setSubmitted(false), 3000);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">협력사 관리</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "검토요청"}
        </button>
      </div>

      {submitted && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">검토요청이 등록되었습니다.</div>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">업체명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.contractorName} onChange={(e) => setForm({ ...form, contractorName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">공종</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">계약금액</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.contractAmount} onChange={(e) => setForm({ ...form, contractAmount: Number(e.target.value) })} /></div>
            <div className="space-y-1 md:col-span-2"><label className="block text-sm font-medium text-foreground">비고</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">검토항목</h2>
              <button type="button" onClick={addItem} className="text-sm text-primary hover:underline">+ 항목추가</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1"><label className="block text-xs text-foreground-muted">점검항목</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={item.checkItem} onChange={(e) => updateItem(idx, "checkItem", e.target.value)} /></div>
                <div className="w-24 space-y-1"><label className="block text-xs text-foreground-muted">결과</label>
                  <select className="h-9 w-full rounded-md border border-border px-2 text-sm" value={item.result} onChange={(e) => updateItem(idx, "result", e.target.value)}>
                    <option value="na">N/A</option><option value="pass">합격</option><option value="fail">불합격</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1"><label className="block text-xs text-foreground-muted">비고</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={item.remarks} onChange={(e) => updateItem(idx, "remarks", e.target.value)} /></div>
                <button type="button" onClick={() => removeItem(idx)} className="h-9 px-2 text-sm text-red-500 hover:text-red-700">삭제</button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-6 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db]">검토요청 등록</button>
          </div>
        </div>
      )}

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {statusTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${statusFilter === t.key ? "bg-[#ecebe8] font-medium text-foreground" : "text-foreground-muted hover:bg-background-soft"}`}
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

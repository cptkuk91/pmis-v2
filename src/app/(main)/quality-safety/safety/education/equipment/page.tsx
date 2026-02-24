"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type PPERow = { _id: string; itemName: string; specification: string; quantity: number; unit: string; recipientName: string; recipientCompany: string; distributionDate: string };
const SITE_ID_KEY = "pmis:siteId";
const columns: DataTableColumn<PPERow>[] = [
  { key: "itemName", header: "품목" },
  { key: "specification", header: "규격" },
  { key: "quantity", header: "수량", className: "w-16 text-right", render: (_v, row) => row.quantity?.toLocaleString() },
  { key: "unit", header: "단위", className: "w-16" },
  { key: "recipientName", header: "수령자" },
  { key: "recipientCompany", header: "소속" },
  { key: "distributionDate", header: "지급일", className: "w-28", render: (_v, row) => row.distributionDate?.slice(0, 10) },
];

export default function SafetyEquipmentPage() {
  const [data, setData] = useState<PPERow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ itemName: "", specification: "", quantity: "", unit: "", recipientName: "", recipientCompany: "", distributionDate: "" });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/ppe?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); } });
  }, []);
  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/safety/ppe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, siteId, quantity: Number(form.quantity) }) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm({ itemName: "", specification: "", quantity: "", unit: "", recipientName: "", recipientCompany: "", distributionDate: "" }); fetchData(1); setPage(1); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">보호구 지급</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">품목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">규격</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">수량 *</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">단위</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">수령자 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">소속</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.recipientCompany} onChange={(e) => setForm({ ...form, recipientCompany: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">지급일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.distributionDate} onChange={(e) => setForm({ ...form, distributionDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

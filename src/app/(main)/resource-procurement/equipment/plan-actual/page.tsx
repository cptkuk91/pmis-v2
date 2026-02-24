"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type EquipmentRow = {
  _id: string;
  equipmentName: string;
  specification: string;
  unit: string;
  planQty: number;
  actualQty: number;
  planDate: string;
  actualDate: string;
  rentalCompany: string;
  unitPrice: number;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<EquipmentRow>[] = [
  { key: "equipmentName", header: "장비명" },
  { key: "specification", header: "규격" },
  { key: "unit", header: "단위", className: "w-16" },
  { key: "planQty", header: "계획수량", className: "w-24 text-right" },
  { key: "actualQty", header: "실적수량", className: "w-24 text-right" },
  { key: "unitPrice", header: "단가", className: "w-28 text-right", render: (_v, row) => row.unitPrice?.toLocaleString() },
  { key: "rentalCompany", header: "임대업체" },
  { key: "planDate", header: "계획일", className: "w-28", render: (_v, row) => row.planDate?.slice(0, 10) },
  { key: "actualDate", header: "실적일", className: "w-28", render: (_v, row) => row.actualDate?.slice(0, 10) },
];

export default function EquipmentPlanActualPage() {
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    equipmentName: "", specification: "", unit: "", planQty: 0, actualQty: 0,
    planDate: "", actualDate: "", rentalCompany: "", unitPrice: 0,
  });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/equipment?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/resource/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ equipmentName: "", specification: "", unit: "", planQty: 0, actualQty: 0, planDate: "", actualDate: "", rentalCompany: "", unitPrice: 0 });
      fetchData(1); setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">장비 계획/실적</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">장비명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">규격</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">단위</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">계획수량</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.planQty} onChange={(e) => setForm({ ...form, planQty: Number(e.target.value) })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">실적수량</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.actualQty} onChange={(e) => setForm({ ...form, actualQty: Number(e.target.value) })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">단가</label><input type="number" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">임대업체</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.rentalCompany} onChange={(e) => setForm({ ...form, rentalCompany: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">계획일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.planDate} onChange={(e) => setForm({ ...form, planDate: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">실적일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.actualDate} onChange={(e) => setForm({ ...form, actualDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

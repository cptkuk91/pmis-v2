"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type ApprovalRow = {
  _id: string;
  supplierName: string;
  materialName: string;
  specification: string;
  requestDate: string;
  status: string;
  remarks: string;
};

const SITE_ID_KEY = "pmis:siteId";

const statusLabel: Record<string, string> = { pending: "대기", approved: "승인", rejected: "반려" };

const columns: DataTableColumn<ApprovalRow>[] = [
  { key: "supplierName", header: "공급업체" },
  { key: "materialName", header: "자재명" },
  { key: "specification", header: "규격" },
  { key: "requestDate", header: "요청일", className: "w-28", render: (_v, row) => row.requestDate?.slice(0, 10) },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
  { key: "remarks", header: "비고" },
];

export default function SupplierApprovalRequestsPage() {
  const [data, setData] = useState<ApprovalRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplierName: "", materialName: "", specification: "", requestDate: "", remarks: "",
  });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/supplier-approvals?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/resource/supplier-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ supplierName: "", materialName: "", specification: "", requestDate: "", remarks: "" });
      fetchData(1); setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">자재공급원 승인요청</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "요청등록"}
        </button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">공급업체 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">자재명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.materialName} onChange={(e) => setForm({ ...form, materialName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">규격</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">요청일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.requestDate} onChange={(e) => setForm({ ...form, requestDate: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-2"><label className="block text-sm font-medium text-foreground">비고</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

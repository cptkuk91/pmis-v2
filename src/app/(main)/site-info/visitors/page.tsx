"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type VisitorRow = {
  _id: string;
  visitorName: string;
  company: string;
  purpose: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime: string;
  contactPerson: string;
  phone: string;
  vehicleNo: string;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<VisitorRow>[] = [
  {
    key: "visitDate",
    header: "방문일",
    className: "w-28",
    render: (v) => (v ? new Date(v as string).toLocaleDateString("ko-KR") : "-"),
  },
  { key: "visitorName", header: "방문자", className: "w-24" },
  { key: "company", header: "소속" },
  { key: "purpose", header: "방문목적" },
  { key: "checkInTime", header: "입장", className: "w-16" },
  { key: "checkOutTime", header: "퇴장", className: "w-16" },
  { key: "contactPerson", header: "면담자", className: "w-24" },
  { key: "vehicleNo", header: "차량번호", className: "w-28" },
];

export default function VisitorsPage() {
  const [data, setData] = useState<VisitorRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    visitorName: "", company: "", purpose: "", visitDate: "",
    checkInTime: "", checkOutTime: "", contactPerson: "", phone: "", vehicleNo: "",
  });

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/sites/visitors?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setData(res.data);
          setTotalPages(res.meta?.totalPages ?? 1);
        }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/sites/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ visitorName: "", company: "", purpose: "", visitDate: "", checkInTime: "", checkOutTime: "", contactPerson: "", phone: "", vehicleNo: "" });
      fetchData(1);
      setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">방문자 관리</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">방문자명 *</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">소속</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">방문일 *</label>
              <input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">방문목적 *</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">입장시간</label>
              <input type="time" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">퇴장시간</label>
              <input type="time" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">면담자</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">연락처</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">차량번호</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

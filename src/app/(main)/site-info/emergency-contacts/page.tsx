"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type ContactRow = {
  _id: string;
  category: string;
  organization: string;
  contactName: string;
  phone: string;
  description: string;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<ContactRow>[] = [
  { key: "category", header: "구분", className: "w-24" },
  { key: "organization", header: "기관/업체" },
  { key: "contactName", header: "담당자", className: "w-24" },
  { key: "phone", header: "연락처", className: "w-36" },
  { key: "description", header: "비고" },
];

export default function EmergencyContactsPage() {
  const [data, setData] = useState<ContactRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "", organization: "", contactName: "", phone: "", description: "" });

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/sites/emergency-contacts?siteId=${siteId}&limit=100`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setData(res.data); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/sites/emergency-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ category: "", organization: "", contactName: "", phone: "", description: "" });
      fetchData();
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">비상연락망</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분 *</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="소방서, 경찰서, 병원 등" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">기관/업체 *</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">담당자</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">연락처 *</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-foreground">비고</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
    </section>
  );
}

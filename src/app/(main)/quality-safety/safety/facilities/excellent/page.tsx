"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type FacilityRow = { _id: string; name: string; location: string; installDate: string; condition: string; description: string };
const SITE_ID_KEY = "pmis:siteId";
const conditionLabel: Record<string, string> = { good: "양호", fair: "보통", poor: "불량" };

const columns: DataTableColumn<FacilityRow>[] = [
  { key: "name", header: "시설명" },
  { key: "location", header: "위치" },
  { key: "installDate", header: "설치일", className: "w-28", render: (_v, row) => row.installDate?.slice(0, 10) },
  { key: "condition", header: "상태", className: "w-20", render: (_v, row) => conditionLabel[row.condition] ?? row.condition },
  { key: "description", header: "설명", render: (_v, row) => (row.description?.length > 40 ? `${row.description.slice(0, 40)}…` : row.description) },
];

const EMPTY_FORM = { name: "", location: "", installDate: "", condition: "good", description: "" };

export default function ExcellentFacilitiesPage() {
  const [data, setData] = useState<FacilityRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/facilities?siteId=${siteId}&facilityType=excellent`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setData(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    const res = await fetch("/api/safety/facilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId, facilityType: "excellent" }),
    });
    const json = await res.json();
    if (json.ok) { setShowForm(false); setForm(EMPTY_FORM); fetchData(); }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">우수 안전시설물</h1>
        <button type="button" onClick={() => setShowForm((p) => !p)} className="rounded-md bg-[#ecebe8] px-3 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background-card p-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">시설명</span>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">위치</span>
            <input required value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">설치일</span>
            <input required type="date" value={form.installDate} onChange={(e) => setForm((f) => ({ ...f, installDate: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">상태</span>
            <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground">
              <option value="good">양호</option>
              <option value="fair">보통</option>
              <option value="poor">불량</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-foreground">설명</span>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button>
          </div>
        </form>
      )}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
    </section>
  );
}

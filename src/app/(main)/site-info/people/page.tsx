"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type PersonnelRow = {
  _id: string;
  name: string;
  company: string;
  position: string;
  role: string;
  phone: string;
  email: string;
  category: string;
};

const SITE_ID_KEY = "pmis:siteId";

const tabs = [
  { key: "constructor", label: "시공사" },
  { key: "partner", label: "관련사" },
  { key: "government", label: "관공서" },
] as const;

const columns: DataTableColumn<PersonnelRow>[] = [
  { key: "name", header: "성명", className: "w-24" },
  { key: "company", header: "소속" },
  { key: "position", header: "직위", className: "w-20" },
  { key: "role", header: "담당업무" },
  { key: "phone", header: "연락처", className: "w-32" },
  { key: "email", header: "이메일" },
];

export default function PeoplePage() {
  const [tab, setTab] = useState<string>("constructor");
  const [data, setData] = useState<PersonnelRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", position: "", role: "", phone: "", email: "" });

  const fetchData = useCallback((p: number, cat: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/sites/personnel?siteId=${siteId}&category=${cat}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setData(res.data);
          setTotalPages(res.meta?.totalPages ?? 1);
        }
      });
  }, []);

  useEffect(() => { fetchData(page, tab); }, [page, tab, fetchData]);

  function handleTabChange(key: string) {
    setTab(key);
    setPage(1);
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const res = await fetch("/api/sites/personnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId, category: tab }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowForm(false);
      setForm({ name: "", company: "", position: "", role: "", phone: "", email: "" });
      fetchData(1, tab);
      setPage(1);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">관계자 현황</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              tab === t.key
                ? "bg-[#ecebe8] font-medium text-foreground"
                : "text-foreground-muted hover:bg-background-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">성명 *</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">소속</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">직위</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">담당업무</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">연락처</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">이메일</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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

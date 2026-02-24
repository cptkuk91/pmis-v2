"use client";

import { useState } from "react";

const SITE_ID_KEY = "pmis:siteId";

type ReviewItem = { checkItem: string; result: string; remarks: string };

export default function SubcontractReviewNewPage() {
  const [form, setForm] = useState({
    title: "", contractorName: "", workType: "", contractAmount: 0, remarks: "",
  });
  const [items, setItems] = useState<ReviewItem[]>([
    { checkItem: "", result: "na", remarks: "" },
  ]);
  const [submitted, setSubmitted] = useState(false);

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
      setForm({ title: "", contractorName: "", workType: "", contractAmount: 0, remarks: "" });
      setItems([{ checkItem: "", result: "na", remarks: "" }]);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">하도급 검토요청</h1>
      {submitted && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">검토요청이 등록되었습니다.</div>
      )}
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
    </section>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type ReportRow = { _id: string; reportType: string; title: string; reportDate: string; agency: string; status: string };
type AssignmentRow = { _id: string; managerName: string; position: string; certificationNo: string; assignedDate: string; role: string };
const SITE_ID_KEY = "pmis:siteId";
const statusLabel: Record<string, string> = { pending: "대기", submitted: "제출", completed: "완료" };

const reportColumns: DataTableColumn<ReportRow>[] = [
  { key: "reportType", header: "유형", className: "w-24" },
  { key: "title", header: "제목" },
  { key: "agency", header: "기관" },
  { key: "reportDate", header: "신고일", className: "w-28", render: (_v, row) => row.reportDate?.slice(0, 10) },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
];
const assignColumns: DataTableColumn<AssignmentRow>[] = [
  { key: "managerName", header: "성명" },
  { key: "position", header: "직위" },
  { key: "role", header: "역할" },
  { key: "certificationNo", header: "자격번호" },
  { key: "assignedDate", header: "선임일", className: "w-28", render: (_v, row) => row.assignedDate?.slice(0, 10) },
];

export default function SafetyManagementSetupPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [tab, setTab] = useState<"report" | "assignment">("report");
  const [showForm, setShowForm] = useState(false);
  const [reportForm, setReportForm] = useState({ reportType: "", title: "", reportDate: "", agency: "" });
  const [assignForm, setAssignForm] = useState({ managerName: "", position: "", certificationNo: "", assignedDate: "", role: "" });

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/management/setup?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) { setReports(res.data.reports); setAssignments(res.data.assignments); } });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    const body = tab === "report" ? { type: "report", ...reportForm, siteId } : { type: "assignment", ...assignForm, siteId };
    const res = await fetch("/api/safety/management/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.ok) { setShowForm(false); fetchData(); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">착수 준비 (인허가 신고/관리자 선임)</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>
      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        <button type="button" onClick={() => setTab("report")} className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === "report" ? "bg-[#ecebe8] font-medium text-foreground" : "text-foreground-muted hover:bg-background-soft"}`}>인허가 신고</button>
        <button type="button" onClick={() => setTab("assignment")} className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === "assignment" ? "bg-[#ecebe8] font-medium text-foreground" : "text-foreground-muted hover:bg-background-soft"}`}>안전관리자 선임</button>
      </div>
      {showForm && tab === "report" && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">유형 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={reportForm.reportType} onChange={(e) => setReportForm({ ...reportForm, reportType: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={reportForm.title} onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">기관</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={reportForm.agency} onChange={(e) => setReportForm({ ...reportForm, agency: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">신고일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={reportForm.reportDate} onChange={(e) => setReportForm({ ...reportForm, reportDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      {showForm && tab === "assignment" && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">성명 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={assignForm.managerName} onChange={(e) => setAssignForm({ ...assignForm, managerName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">직위</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={assignForm.position} onChange={(e) => setAssignForm({ ...assignForm, position: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">역할</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={assignForm.role} onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">자격번호</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={assignForm.certificationNo} onChange={(e) => setAssignForm({ ...assignForm, certificationNo: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">선임일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={assignForm.assignedDate} onChange={(e) => setAssignForm({ ...assignForm, assignedDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}
      {tab === "report" ? <DataTable columns={reportColumns} data={reports} rowKey={(row) => row._id} /> : <DataTable columns={assignColumns} data={assignments} rowKey={(row) => row._id} />}
    </section>
  );
}

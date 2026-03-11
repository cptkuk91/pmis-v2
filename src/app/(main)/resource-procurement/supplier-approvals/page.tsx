"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  DEFAULT_SUPPLIER_APPROVAL_TYPE,
  SUPPLIER_APPROVAL_TYPE_LABEL,
  SUPPLIER_APPROVAL_TYPE_OPTIONS,
  type SupplierApprovalType,
} from "@/lib/supplier-approval";

type ApprovalRow = {
  _id: string;
  approvalType?: string;
  supplierName: string;
  materialName: string;
  specification: string;
  requestDate: string;
  status: string;
  approvedAt: string;
  remarks: string;
};

type ApprovalFormState = {
  approvalType: SupplierApprovalType;
  supplierName: string;
  materialName: string;
  specification: string;
  requestDate: string;
  remarks: string;
};

type SpecificationOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

const SITE_ID_KEY = "pmis:siteId";

const statusLabel: Record<string, string> = { pending: "대기", approved: "승인", rejected: "반려" };

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKoreanDate(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return "";
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function createDefaultForm(): ApprovalFormState {
  return {
    approvalType: DEFAULT_SUPPLIER_APPROVAL_TYPE,
    supplierName: "",
    materialName: "",
    specification: "",
    requestDate: getTodayDateInputValue(),
    remarks: "",
  };
}

const columns: DataTableColumn<ApprovalRow>[] = [
  {
    key: "approvalType",
    header: "구분",
    className: "w-20",
    render: (_value, row) =>
      SUPPLIER_APPROVAL_TYPE_LABEL[
        (row.approvalType as SupplierApprovalType) || DEFAULT_SUPPLIER_APPROVAL_TYPE
      ],
  },
  { key: "supplierName", header: "공급업체" },
  { key: "materialName", header: "품목명" },
  { key: "specification", header: "규격" },
  { key: "requestDate", header: "요청일", className: "w-28", render: (_v, row) => row.requestDate?.slice(0, 10) },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
  { key: "approvedAt", header: "승인일", className: "w-28", render: (_v, row) => row.approvedAt?.slice(0, 10) ?? "-" },
  { key: "remarks", header: "비고" },
];

const tabs = [
  { key: "", label: "전체" },
  { key: "approved", label: "승인" },
  { key: "pending", label: "대기" },
  { key: "rejected", label: "반려" },
] as const;

export default function SupplierApprovalsPage() {
  const [data, setData] = useState<ApprovalRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ApprovalFormState>(createDefaultForm);
  const [specificationOptions, setSpecificationOptions] = useState<SpecificationOption[]>([]);
  const [isLoadingSpecificationOptions, setIsLoadingSpecificationOptions] = useState(false);

  const fetchData = useCallback((p: number, status: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    const url = `/api/resource/supplier-approvals?siteId=${siteId}&page=${p}${status ? `&status=${status}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page, statusFilter); }, [page, statusFilter, fetchData]);

  const fetchSpecificationOptions = useCallback(async (approvalType: SupplierApprovalType) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setSpecificationOptions([]);
      return;
    }

    setIsLoadingSpecificationOptions(true);
    try {
      const response = await fetch(
        `/api/resource/supplier-approvals/specification-options?siteId=${siteId}&approvalType=${approvalType}`,
      );
      const result = (await response.json()) as {
        ok: boolean;
        data?: SpecificationOption[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "규격 코드 조회 실패");
      }
      setSpecificationOptions(result.data ?? []);
    } catch {
      setSpecificationOptions([]);
    } finally {
      setIsLoadingSpecificationOptions(false);
    }
  }, []);

  useEffect(() => {
    void fetchSpecificationOptions(form.approvalType);
  }, [form.approvalType, fetchSpecificationOptions]);

  function handleTabChange(key: string) {
    setStatusFilter(key);
    setPage(1);
  }

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
      setForm(createDefaultForm());
      setPage(1);
      fetchData(1, statusFilter);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">업체 승인</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showForm ? "취소" : "요청등록"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">구분 *</label><select className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.approvalType} onChange={(e) => setForm({ ...form, approvalType: e.target.value as SupplierApprovalType })}>{SUPPLIER_APPROVAL_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{SUPPLIER_APPROVAL_TYPE_LABEL[type]}</option>)}</select></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">공급업체 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">{form.approvalType === "equipment" ? "장비명 *" : "자재명 *"}</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.materialName} onChange={(e) => setForm({ ...form, materialName: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">규격</label><select className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} disabled={isLoadingSpecificationOptions}><option value="">{isLoadingSpecificationOptions ? "규격 불러오는 중..." : specificationOptions.length > 0 ? "규격 선택" : "설정된 규격 없음"}</option>{specificationOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select><p className="text-xs text-foreground-muted">{specificationOptions.length > 0 ? `${SUPPLIER_APPROVAL_TYPE_LABEL[form.approvalType]} 규격 코드에서 선택합니다.` : `${SUPPLIER_APPROVAL_TYPE_LABEL[form.approvalType]} 규격 코드를 시스템 관리에서 먼저 등록해 주세요.`}</p></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">요청일</label><input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.requestDate} onChange={(e) => setForm({ ...form, requestDate: e.target.value })} /><p className="text-xs text-foreground-muted">{formatKoreanDate(form.requestDate)}</p></div>
            <div className="space-y-1 md:col-span-2"><label className="block text-sm font-medium text-foreground">비고</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={handleSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button></div>
        </div>
      )}

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((t) => (
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

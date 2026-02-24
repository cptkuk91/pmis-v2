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
  approvedAt: string;
  approvedBy: string;
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
  { key: "approvedAt", header: "승인일", className: "w-28", render: (_v, row) => row.approvedAt?.slice(0, 10) ?? "-" },
  { key: "remarks", header: "비고" },
];

const tabs = [
  { key: "", label: "전체" },
  { key: "approved", label: "승인" },
  { key: "pending", label: "대기" },
  { key: "rejected", label: "반려" },
] as const;

export default function SupplierApprovalStatusPage() {
  const [data, setData] = useState<ApprovalRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback((p: number, status: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    const url = `/api/resource/supplier-approvals/status?siteId=${siteId}&page=${p}${status ? `&status=${status}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page, statusFilter); }, [page, statusFilter, fetchData]);

  function handleTabChange(key: string) {
    setStatusFilter(key);
    setPage(1);
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">자재공급원 승인현황</h1>
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

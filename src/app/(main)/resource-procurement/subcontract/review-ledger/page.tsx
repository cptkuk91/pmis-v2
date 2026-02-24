"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type ReviewRow = {
  _id: string;
  title: string;
  contractorName: string;
  workType: string;
  contractAmount: number;
  status: string;
  requestDate: string;
};

const SITE_ID_KEY = "pmis:siteId";

const statusLabel: Record<string, string> = { pending: "대기", approved: "승인", rejected: "반려" };

const columns: DataTableColumn<ReviewRow>[] = [
  { key: "title", header: "제목" },
  { key: "contractorName", header: "업체명" },
  { key: "workType", header: "공종" },
  { key: "contractAmount", header: "계약금액", className: "w-32 text-right", render: (_v, row) => row.contractAmount?.toLocaleString() },
  { key: "status", header: "상태", className: "w-20", render: (_v, row) => statusLabel[row.status] ?? row.status },
  { key: "requestDate", header: "요청일", className: "w-28", render: (_v, row) => row.requestDate?.slice(0, 10) },
];

export default function SubcontractReviewLedgerPage() {
  const [data, setData] = useState<ReviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/subcontract-reviews?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">하도급 검토대장</h1>
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

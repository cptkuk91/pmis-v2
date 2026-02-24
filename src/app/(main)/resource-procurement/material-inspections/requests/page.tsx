"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type InspectionRow = {
  _id: string;
  materialName: string;
  quantity: number;
  unit: string;
  inspectionDate: string;
  result: string;
  inspector: string;
  remarks: string;
};

const SITE_ID_KEY = "pmis:siteId";

const resultLabel: Record<string, string> = { pass: "합격", fail: "불합격", pending: "대기" };

const columns: DataTableColumn<InspectionRow>[] = [
  { key: "materialName", header: "자재명" },
  { key: "quantity", header: "수량", className: "w-20 text-right" },
  { key: "unit", header: "단위", className: "w-16" },
  { key: "inspectionDate", header: "검수일", className: "w-28", render: (_v, row) => row.inspectionDate?.slice(0, 10) },
  { key: "result", header: "결과", className: "w-20", render: (_v, row) => resultLabel[row.result] ?? row.result },
  { key: "inspector", header: "검수자" },
  { key: "remarks", header: "비고" },
];

export default function MaterialInspectionRequestsPage() {
  const [data, setData] = useState<InspectionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/material-inspections?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">반입자재 검수요청</h1>
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type WorkerRow = { _id: string; firstDate: string; company: string; jobType: string };
const SITE_ID_KEY = "pmis:siteId";
const columns: DataTableColumn<WorkerRow>[] = [
  { key: "_id", header: "성명" },
  { key: "company", header: "소속" },
  { key: "jobType", header: "직종" },
  { key: "firstDate", header: "최초출역일", className: "w-28", render: (_v, row) => row.firstDate?.slice(0, 10) },
];

export default function NewWorkerEducationPage() {
  const [data, setData] = useState<WorkerRow[]>([]);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/new-workers?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setData(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">신규교육 대상자</h1>
      <p className="text-sm text-foreground-muted">최근 30일 이내 최초 출역일 기준 신규교육 대상자 목록입니다.</p>
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
    </section>
  );
}

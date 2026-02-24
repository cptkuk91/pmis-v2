"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type SummaryRow = {
  company: string;
  jobType: string;
  totalWorkers: number;
  totalHours: number;
  totalOvertime: number;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<SummaryRow>[] = [
  { key: "company", header: "소속" },
  { key: "jobType", header: "직종" },
  { key: "totalWorkers", header: "인원수", className: "w-24 text-right" },
  { key: "totalHours", header: "총근무시간", className: "w-28 text-right" },
  { key: "totalOvertime", header: "총잔업시간", className: "w-28 text-right" },
];

export default function WorkforceSummaryPage() {
  const [data, setData] = useState<SummaryRow[]>([]);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/workforce/summary?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          const rows = res.data.map((r: { _id: { company: string; jobType: string }; totalWorkers: number; totalHours: number; totalOvertime: number }) => ({
            company: r._id.company,
            jobType: r._id.jobType,
            totalWorkers: r.totalWorkers,
            totalHours: r.totalHours,
            totalOvertime: r.totalOvertime,
          }));
          setData(rows);
        }
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">출역 집계</h1>
      <DataTable columns={columns} data={data} rowKey={(row) => `${row.company}-${row.jobType}`} />
    </section>
  );
}

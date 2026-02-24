"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type AttendanceRow = {
  _id: string;
  attendanceDate: string;
  workerName: string;
  company: string;
  jobType: string;
  workType: string;
  hoursWorked: number;
  overtimeHours: number;
};

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<AttendanceRow>[] = [
  { key: "workerName", header: "성명" },
  { key: "company", header: "소속" },
  { key: "jobType", header: "직종" },
  { key: "workType", header: "공종" },
  { key: "attendanceDate", header: "출역일", className: "w-28", render: (_v, row) => row.attendanceDate?.slice(0, 10) },
  { key: "hoursWorked", header: "근무시간", className: "w-24 text-right" },
  { key: "overtimeHours", header: "잔업", className: "w-20 text-right" },
];

export default function WorkforceRosterPage() {
  const [data, setData] = useState<AttendanceRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/workforce/daily?siteId=${siteId}&page=${p}&limit=50`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setData(res.data); setTotalPages(res.meta?.totalPages ?? 1); }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">연명부</h1>
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

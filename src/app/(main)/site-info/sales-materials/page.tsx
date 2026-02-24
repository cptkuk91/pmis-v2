"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { FileUpload } from "@/components/ui/file-upload";

type FileRow = {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedBy: { name: string } | null;
  createdAt: string;
};

const SITE_ID_KEY = "pmis:siteId";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const columns: DataTableColumn<FileRow>[] = [
  { key: "originalName", header: "파일명" },
  { key: "mimeType", header: "유형", className: "w-32" },
  { key: "size", header: "크기", className: "w-20", render: (v) => formatSize(v as number) },
  {
    key: "uploadedBy",
    header: "업로더",
    className: "w-24",
    render: (v) => (v as FileRow["uploadedBy"])?.name ?? "-",
  },
  {
    key: "createdAt",
    header: "업로드일",
    className: "w-28",
    render: (v) => new Date(v as string).toLocaleDateString("ko-KR"),
  },
];

export default function SalesMaterialsPage() {
  const [data, setData] = useState<FileRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/sites/sales-materials?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setData(res.data);
          setTotalPages(res.meta?.totalPages ?? 1);
        }
      });
  }, []);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleUpload() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", "sales-materials");
      fd.append("siteId", siteId);
      fd.append("uploadedBy", "000000000000000000000000");
      await fetch("/api/files/upload", { method: "POST", body: fd });
    }
    setShowUpload(false);
    setFiles([]);
    fetchData(1);
    setPage(1);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">분양자료</h1>
        <button type="button" onClick={() => setShowUpload(!showUpload)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showUpload ? "취소" : "업로드"}
        </button>
      </div>

      {showUpload && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <FileUpload multiple accept="*/*" onFilesChange={setFiles} />
          <div className="flex justify-end">
            <button type="button" onClick={handleUpload} disabled={files.length === 0} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-50">
              업로드
            </button>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Pagination } from "@/components/ui/pagination";
import { FileUpload } from "@/components/ui/file-upload";

type PhotoRow = {
  _id: string;
  originalName: string;
  storagePath: string;
  size: number;
  createdAt: string;
  uploadedBy: { name: string } | null;
};

const SITE_ID_KEY = "pmis:siteId";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function ModelhousePhotosPage() {
  const [data, setData] = useState<PhotoRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/sites/modelhouse-photos?siteId=${siteId}&page=${p}`)
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
      fd.append("module", "modelhouse-photos");
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
        <h1 className="text-xl font-semibold text-foreground">모델하우스사진</h1>
        <button type="button" onClick={() => setShowUpload(!showUpload)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">
          {showUpload ? "취소" : "업로드"}
        </button>
      </div>

      {showUpload && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <FileUpload multiple accept="image/*" label="사진 선택" onFilesChange={setFiles} />
          <div className="flex justify-end">
            <button type="button" onClick={handleUpload} disabled={files.length === 0} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-50">
              업로드
            </button>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="rounded-lg border border-border bg-background-card p-12 text-center text-foreground-muted">
          등록된 사진이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {data.map((photo) => (
            <div key={photo._id} className="overflow-hidden rounded-lg border border-border bg-background-card">
              <div className="aspect-square bg-background-soft flex items-center justify-center">
                <img
                  src={`/uploads/${photo.storagePath}`}
                  alt={photo.originalName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-foreground">{photo.originalName}</p>
                <p className="text-xs text-foreground-muted">
                  {formatSize(photo.size)} · {new Date(photo.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}

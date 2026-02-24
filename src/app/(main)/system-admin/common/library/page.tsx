"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FileUpload, FormInput, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type LibraryItem = {
  _id: string;
  categoryCode: string;
  title: string;
  description: string;
  authorName: string;
  fileAssetId?: string | null;
  createdAt: string;
};

type LibraryResponse = {
  ok: boolean;
  data: LibraryItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type UploadResponse = {
  ok: boolean;
  data?: {
    fileAssetId: string;
    originalName: string;
    storagePath: string;
  };
  error?: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR");
}

function stringifyObjectId(value: unknown): string {
  if (!value) {
    return "";
  }
  return String(value);
}

export default function SystemLibraryPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [categoryCode, setCategoryCode] = useState("GENERAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileAssetId, setFileAssetId] = useState("");
  const [fileName, setFileName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sort, setSort] = useState<"latest" | "oldest" | "title_asc" | "title_desc">("latest");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadLibrary = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          categoryCode: categoryFilter,
          sort,
        });
        const response = await fetch(`/api/library?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as LibraryResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "자료실 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "자료실 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [categoryFilter, keyword, sort],
  );

  useEffect(() => {
    void loadLibrary(1);
  }, [loadLibrary]);

  function resetForm() {
    setEditingItemId(null);
    setCategoryCode("GENERAL");
    setTitle("");
    setDescription("");
    setFileAssetId("");
    setFileName("");
  }

  function handleEdit(item: LibraryItem) {
    setEditingItemId(item._id);
    setCategoryCode(item.categoryCode);
    setTitle(item.title);
    setDescription(item.description);
    const nextFileAssetId = stringifyObjectId(item.fileAssetId);
    setFileAssetId(nextFileAssetId);
    setFileName(nextFileAssetId ? `첨부 ID: ${nextFileAssetId}` : "");
    setMessage(null);
    setError(null);
  }

  async function handleFileUpload(files: File[]) {
    const first = files[0];
    if (!first) {
      setFileAssetId("");
      setFileName("");
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", first);
      formData.append("module", "library");
      if (user.userId) {
        formData.append("uploadedBy", user.userId);
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as UploadResponse;
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "파일 업로드 실패");
      }
      setFileAssetId(result.data.fileAssetId);
      setFileName(result.data.originalName);
      setMessage("파일이 업로드되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 업로드 실패");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const endpoint = editingItemId ? `/api/library/${editingItemId}` : "/api/library";
      const method = editingItemId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryCode, title, description, fileAssetId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "자료 저장 실패");
      }
      setMessage(editingItemId ? "자료가 수정되었습니다." : "자료가 등록되었습니다.");
      resetForm();
      await loadLibrary(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "자료 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!canManage || !confirm("자료를 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/library/${itemId}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "자료 삭제 실패");
      }
      if (editingItemId === itemId) {
        resetForm();
      }
      setMessage("자료가 삭제되었습니다.");
      await loadLibrary(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "자료 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">자료실</h1>
        <p className="mt-1 text-sm text-foreground-muted">자료실 목록/등록 기능</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="제목/설명/등록자"
        />
        <FormInput
          label="카테고리"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value.toUpperCase())}
          placeholder="ALL 또는 코드"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">정렬</span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "latest" | "oldest" | "title_asc" | "title_desc")
            }
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="title_asc">제목 오름차순</option>
            <option value="title_desc">제목 내림차순</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadLibrary(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canManage ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_2fr]">
            <FormInput
              label="카테고리"
              value={categoryCode}
              onChange={(event) => setCategoryCode(event.target.value.toUpperCase())}
              required
            />
            <FormInput
              label="제목"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <FormInput
              label="설명"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <FileUpload label="첨부파일" multiple={false} onFilesChange={(files) => void handleFileUpload(files)} />
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
              >
                {editingItemId ? "수정" : "등록"}
              </button>
              {editingItemId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                >
                  취소
                </button>
              ) : null}
            </div>
          </div>
          {fileName ? (
            <p className="text-xs text-foreground-muted">
              첨부: {fileName} ({fileAssetId})
            </p>
          ) : null}
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">등록/수정/삭제는 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<LibraryItem>
        columns={[
          { key: "categoryCode", header: "분류", className: "w-28" },
          { key: "title", header: "제목" },
          {
            key: "description",
            header: "설명",
            render: (value) => {
              const text = String(value ?? "");
              return text.length > 42 ? `${text.slice(0, 42)}...` : text;
            },
          },
          {
            key: "fileAssetId",
            header: "첨부",
            className: "w-36",
            render: (value) => (value ? "있음" : "-"),
          },
          { key: "authorName", header: "등록자", className: "w-24" },
          {
            key: "createdAt",
            header: "등록일",
            className: "w-32",
            render: (value) => formatDate(String(value)),
          },
          {
            key: "_id",
            header: "관리",
            className: "w-36",
            render: (_, row) =>
              canManage ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(row)}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row._id)}
                    className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                "-"
              ),
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 자료가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadLibrary(nextPage)} />
    </section>
  );
}

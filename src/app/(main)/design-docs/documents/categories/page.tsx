"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type CategoryItem = {
  _id: string;
  categoryCode: string;
  categoryName: string;
  parentCategoryId?: string | null;
  sortOrder: number;
  isActive: boolean;
};

type CategoryResponse = {
  ok: boolean;
  data: CategoryItem[];
  error?: string;
};

export default function DocumentCategoriesPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "site_admin"), [user.role]);

  const [items, setItems] = useState<CategoryItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: keyword,
        active: activeFilter,
      });
      const response = await fetch(`/api/documents/categories?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as CategoryResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "문서분류 조회 실패");
      }
      setItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문서분류 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, keyword]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  function resetForm() {
    setEditingId(null);
    setCategoryCode("");
    setCategoryName("");
    setParentCategoryId("");
    setSortOrder("0");
    setIsActive(true);
  }

  function handleEdit(item: CategoryItem) {
    setEditingId(item._id);
    setCategoryCode(item.categoryCode);
    setCategoryName(item.categoryName);
    setParentCategoryId(item.parentCategoryId ? String(item.parentCategoryId) : "");
    setSortOrder(String(item.sortOrder));
    setIsActive(item.isActive);
    setError(null);
    setMessage(null);
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
      const endpoint = editingId
        ? `/api/documents/categories/${editingId}`
        : "/api/documents/categories";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryCode,
          categoryName,
          parentCategoryId,
          sortOrder: Number(sortOrder),
          isActive,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "문서분류 저장 실패");
      }
      resetForm();
      setMessage(editingId ? "문서분류가 수정되었습니다." : "문서분류가 등록되었습니다.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "문서분류 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm("문서분류를 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/documents/categories/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "문서분류 삭제 실패");
      }
      if (editingId === id) {
        resetForm();
      }
      setMessage("문서분류가 삭제되었습니다.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "문서분류 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">문서분류체계</h1>
        <p className="mt-1 text-sm text-foreground-muted">문서 분류코드/명칭을 관리합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_auto]">
        <FormInput label="검색어" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="코드/명칭" />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">활성여부</span>
          <select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as "all" | "true" | "false")}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>
        </label>
        <button type="button" onClick={() => void loadItems()} className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card">
          조회
        </button>
      </div>

      {canManage ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_1fr_120px_120px_auto_auto]">
          <FormInput label="분류코드" value={categoryCode} onChange={(event) => setCategoryCode(event.target.value.toUpperCase())} required />
          <FormInput label="분류명" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
          <FormInput label="상위분류ID(선택)" value={parentCategoryId} onChange={(event) => setParentCategoryId(event.target.value)} />
          <FormInput label="정렬" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">활성</span>
            <select
              value={isActive ? "true" : "false"}
              onChange={(event) => setIsActive(event.target.value === "true")}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
          </label>
          <button type="submit" disabled={isSubmitting} className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60">
            {editingId ? "수정" : "등록"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="mt-6 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft">
              취소
            </button>
          ) : null}
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">문서분류 관리에는 `site_admin` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<CategoryItem>
        columns={[
          { key: "categoryCode", header: "코드", className: "w-24" },
          { key: "categoryName", header: "분류명" },
          {
            key: "parentCategoryId",
            header: "상위분류ID",
            className: "w-44",
            render: (value) => (value ? String(value) : "-"),
          },
          { key: "sortOrder", header: "정렬", className: "w-16" },
          {
            key: "isActive",
            header: "활성",
            className: "w-16",
            render: (value) => (value ? "Y" : "N"),
          },
          {
            key: "_id",
            header: "관리",
            className: "w-36",
            render: (_, row) =>
              canManage ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleEdit(row)} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft">
                    수정
                  </button>
                  <button type="button" onClick={() => void handleDelete(row._id)} className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10">
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
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 분류가 없습니다."}
      />
    </section>
  );
}

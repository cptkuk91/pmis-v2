"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Modal } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import { getNextDocumentCategoryCode } from "@/lib/document-category-code-format";

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
  const [allItems, setAllItems] = useState<CategoryItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const parentOptions = useMemo(
    () => allItems.filter((item) => item._id !== editingId),
    [allItems, editingId],
  );
  const parentLabelMap = useMemo(
    () =>
      new Map(
        allItems.map((item) => [
          item._id,
          `${item.categoryCode} · ${item.categoryName}`,
        ]),
      ),
    [allItems],
  );
  const previewCategoryCode = useMemo(() => {
    if (editingId) {
      return items.find((item) => item._id === editingId)?.categoryCode ?? "";
    }

    return getNextDocumentCategoryCode(
      allItems.map((item) => ({
        id: item._id,
        code: item.categoryCode,
        parentCategoryId: item.parentCategoryId ? String(item.parentCategoryId) : null,
      })),
      parentCategoryId || null,
    );
  }, [allItems, editingId, items, parentCategoryId]);

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

  const loadAllItems = useCallback(async () => {
    try {
      const response = await fetch("/api/documents/categories?active=all", { cache: "no-store" });
      const result = (await response.json()) as CategoryResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "문서분류 조회 실패");
      }
      setAllItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문서분류 조회 실패");
    }
  }, []);

  useEffect(() => {
    void loadAllItems();
  }, [loadAllItems]);

  function resetForm() {
    setEditingId(null);
    setCategoryName("");
    setParentCategoryId("");
    setSortOrder("0");
    setIsActive(true);
  }

  function handleEdit(item: CategoryItem) {
    setEditingId(item._id);
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
      await Promise.all([loadItems(), loadAllItems()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문서분류 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDeleteRequest(item: CategoryItem) {
    if (!canManage) {
      return;
    }

    setDeleteTarget(item);
    setError(null);
    setMessage(null);
  }

  async function handleDeleteConfirm() {
    if (!canManage || !deleteTarget) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents/categories/${deleteTarget._id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "문서분류 삭제 실패");
      }
      if (editingId === deleteTarget._id) {
        resetForm();
      }
      setDeleteTarget(null);
      setMessage("문서분류가 삭제되었습니다.");
      await Promise.all([loadItems(), loadAllItems()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문서분류 삭제 실패");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">문서분류체계</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          분류 코드는 등록 시 자동 생성되고, 상위 분류는 선택형으로 관리합니다.
        </p>
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
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">분류코드</span>
            <input
              value={previewCategoryCode || "자동 생성 예정"}
              readOnly
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none"
            />
            <p className="text-xs text-foreground-muted">
              {editingId ? "분류 코드는 등록 후 고정됩니다." : "상위 분류 선택 기준으로 자동 채번됩니다."}
            </p>
          </label>
          <FormInput label="분류명" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상위 분류</span>
            <select
              value={parentCategoryId}
              onChange={(event) => setParentCategoryId(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="">상위 분류 없음</option>
              {parentOptions.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.categoryCode} · {item.categoryName}
                </option>
              ))}
            </select>
            {parentOptions.length === 0 ? (
              <p className="text-xs text-foreground-muted">
                상위로 선택할 분류가 아직 없습니다.
              </p>
            ) : null}
          </label>
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
            header: "상위 분류",
            className: "w-44",
            render: (value) => (value ? parentLabelMap.get(String(value)) ?? String(value) : "-"),
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
                  <button type="button" onClick={() => handleDeleteRequest(row)} className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10">
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

      <Modal
        open={deleteTarget !== null}
        title="문서분류 삭제"
        onClose={() => {
          if (isDeleting) {
            return;
          }
          setDeleteTarget(null);
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {deleteTarget
              ? `${deleteTarget.categoryCode} · ${deleteTarget.categoryName} 분류를 삭제하시겠습니까?`
              : "선택한 문서분류를 삭제하시겠습니까?"}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteConfirm()}
              disabled={isDeleting}
              className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

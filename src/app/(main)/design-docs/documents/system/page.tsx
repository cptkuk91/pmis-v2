"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type SystemItem = {
  _id: string;
  itemCode: string;
  itemName: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

type SystemResponse = {
  ok: boolean;
  data: SystemItem[];
  error?: string;
};

export default function DocumentSystemPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<SystemItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
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
      const response = await fetch(`/api/documents/system?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as SystemResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "Document System 조회 실패");
      }
      setItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document System 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, keyword]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  function resetForm() {
    setEditingId(null);
    setItemCode("");
    setItemName("");
    setDescription("");
    setSortOrder("0");
    setIsActive(true);
  }

  function handleEdit(item: SystemItem) {
    setEditingId(item._id);
    setItemCode(item.itemCode);
    setItemName(item.itemName);
    setDescription(item.description);
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
      const endpoint = editingId ? `/api/documents/system/${editingId}` : "/api/documents/system";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCode,
          itemName,
          description,
          sortOrder: Number(sortOrder),
          isActive,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "Document System 저장 실패");
      }
      resetForm();
      setMessage(editingId ? "항목이 수정되었습니다." : "항목이 등록되었습니다.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document System 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm("항목을 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/documents/system/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "Document System 삭제 실패");
      }
      if (editingId === id) {
        resetForm();
      }
      setMessage("항목이 삭제되었습니다.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document System 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Document System</h1>
        <p className="mt-1 text-sm text-foreground-muted">문서 시스템 관련 마스터 항목을 관리합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_auto]">
        <FormInput label="검색어" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="코드/명칭/설명" />
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[140px_220px_1fr_120px_120px_auto_auto]">
          <FormInput label="코드" value={itemCode} onChange={(event) => setItemCode(event.target.value.toUpperCase())} required />
          <FormInput label="명칭" value={itemName} onChange={(event) => setItemName(event.target.value)} required />
          <FormInput label="설명" value={description} onChange={(event) => setDescription(event.target.value)} />
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
        <p className="text-sm text-foreground-muted">Document System 관리는 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<SystemItem>
        columns={[
          { key: "itemCode", header: "코드", className: "w-24" },
          { key: "itemName", header: "명칭", className: "w-40" },
          { key: "description", header: "설명" },
          { key: "sortOrder", header: "정렬", className: "w-16" },
          { key: "isActive", header: "활성", className: "w-16", render: (value) => (value ? "Y" : "N") },
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
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 항목이 없습니다."}
      />
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type CodeGroup = {
  _id: string;
  groupCode: string;
  groupName: string;
};

type CodeItem = {
  _id: string;
  itemCode: string;
  itemName: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
};

type CodeResponse = {
  ok: boolean;
  data: { group: CodeGroup | null; items: CodeItem[] };
  error?: string;
};

type Props = {
  groupCode:
    | "partners"
    | "materials"
    | "equipment"
    | "material-specifications"
    | "equipment-specifications";
  title: string;
  subtitle?: string;
};

export function CodeItemsManager({ groupCode, title, subtitle }: Props) {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "site_admin"), [user.role]);

  const [groupName, setGroupName] = useState(groupCode.toUpperCase());
  const [items, setItems] = useState<CodeItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("true");
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "code_asc" | "code_desc">(
    "name_asc",
  );

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const nextSortOrder = useMemo(() => {
    return items.reduce((maxOrder, item) => Math.max(maxOrder, item.sortOrder), 0) + 1;
  }, [items]);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: keyword,
        active: activeFilter,
        sort,
      });
      const response = await fetch(`/api/system/codes/${groupCode}?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as CodeResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "코드 조회 실패");
      }
      setGroupName(result.data.group?.groupName ?? groupCode.toUpperCase());
      setItems(result.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "코드 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, groupCode, keyword, sort]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!editingItemId) {
      setSortOrder(String(nextSortOrder));
    }
  }, [editingItemId, nextSortOrder]);

  function resetForm() {
    setEditingItemId(null);
    setItemCode("");
    setItemName("");
    setDescription("");
    setSortOrder(String(nextSortOrder));
    setIsActive(true);
  }

  function handleEdit(item: CodeItem) {
    setEditingItemId(item._id);
    setItemCode(item.itemCode);
    setItemName(item.itemName);
    setDescription(item.description ?? "");
    setSortOrder(String(item.sortOrder));
    setIsActive(item.isActive);
    setMessage(null);
    setError(null);
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
      const endpoint = editingItemId
        ? `/api/system/codes/${groupCode}/${editingItemId}`
        : `/api/system/codes/${groupCode}`;
      const method = editingItemId ? "PATCH" : "POST";
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
        throw new Error(result.error ?? "코드 저장 실패");
      }
      setMessage(editingItemId ? "코드가 수정되었습니다." : "코드가 등록되었습니다.");
      resetForm();
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "코드 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!canManage || !confirm("코드를 삭제하시겠습니까?")) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/system/codes/${groupCode}/${itemId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "코드 삭제 실패");
      }
      if (editingItemId === itemId) {
        resetForm();
      }
      setMessage("코드가 삭제되었습니다.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "코드 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {subtitle ?? `그룹: ${groupName} (site_admin 이상)`}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="코드/명칭/설명"
        />
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
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">정렬</span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value as
                  | "name_asc"
                  | "name_desc"
                  | "code_asc"
                  | "code_desc",
              )
            }
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="name_asc">명칭 오름차순</option>
            <option value="name_desc">명칭 내림차순</option>
            <option value="code_asc">코드 오름차순</option>
            <option value="code_desc">코드 내림차순</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadItems()}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canManage ? (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 md:grid-cols-[180px_220px_140px_auto_auto]"
        >
          <FormInput
            label="코드"
            value={itemCode}
            onChange={(event) => setItemCode(event.target.value.toUpperCase())}
            required
          />
          <FormInput
            label="명칭"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            required
          />
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
          >
            {editingItemId ? "수정" : "등록"}
          </button>
          {editingItemId ? (
            <button
              type="button"
              onClick={resetForm}
              className="mt-6 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              취소
            </button>
          ) : null}
          <label className="space-y-1 md:col-span-5">
            <span className="block text-sm font-medium text-foreground">설명</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="필요하면 규격 설명이나 사용 메모를 입력"
            />
          </label>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">코드 관리는 `site_admin` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<CodeItem>
        columns={[
          { key: "itemCode", header: "코드", className: "w-28" },
          { key: "itemName", header: "명칭", className: "w-48" },
          { key: "description", header: "설명" },
          {
            key: "isActive",
            header: "활성",
            className: "w-20",
            render: (value) => (value ? "Y" : "N"),
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
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 코드가 없습니다."}
      />
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type TemplateItem = {
  _id: string;
  templateCode: string;
  templateName: string;
  description: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
};

type TemplateResponse = {
  ok: boolean;
  data: TemplateItem[];
  error?: string;
};

export default function FormTemplatesPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<TemplateItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateCode, setTemplateCode] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
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
      const response = await fetch(`/api/documents/templates?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as TemplateResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "양식함 조회 실패");
      }
      setItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "양식함 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, keyword]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  function resetForm() {
    setEditingId(null);
    setTemplateCode("");
    setTemplateName("");
    setDescription("");
    setBody("");
    setSortOrder("0");
    setIsActive(true);
  }

  function handleEdit(item: TemplateItem) {
    setEditingId(item._id);
    setTemplateCode(item.templateCode);
    setTemplateName(item.templateName);
    setDescription(item.description);
    setBody(item.body);
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
      const endpoint = editingId ? `/api/documents/templates/${editingId}` : "/api/documents/templates";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode,
          templateName,
          description,
          body,
          sortOrder: Number(sortOrder),
          isActive,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "양식 저장 실패");
      }
      resetForm();
      setMessage(editingId ? "양식이 수정되었습니다." : "양식이 등록되었습니다.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "양식 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm("양식을 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/documents/templates/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "양식 삭제 실패");
      }
      if (editingId === id) {
        resetForm();
      }
      setMessage("양식이 삭제되었습니다.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "양식 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">양식함</h1>
        <p className="mt-1 text-sm text-foreground-muted">문서 양식 템플릿을 등록/수정합니다.</p>
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
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_220px_1fr_120px_120px]">
            <FormInput label="코드" value={templateCode} onChange={(event) => setTemplateCode(event.target.value.toUpperCase())} required />
            <FormInput label="명칭" value={templateName} onChange={(event) => setTemplateName(event.target.value)} required />
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
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">양식 본문</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={isSubmitting} className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60">
              {editingId ? "수정" : "등록"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft">
                취소
              </button>
            ) : null}
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">양식함 관리는 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<TemplateItem>
        columns={[
          { key: "templateCode", header: "코드", className: "w-24" },
          { key: "templateName", header: "명칭", className: "w-40" },
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
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 양식이 없습니다."}
      />
    </section>
  );
}

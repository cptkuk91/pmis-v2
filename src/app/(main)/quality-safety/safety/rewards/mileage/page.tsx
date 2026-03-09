"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import {
  DEFAULT_SAFETY_MILEAGE_CATEGORY,
  SAFETY_MILEAGE_CATEGORIES,
  type SafetyMileageCategory,
} from "@/lib/safety-mileage-category";

type Row = {
  _id: string;
  userId?: string;
  recipientName: string;
  category: string;
  recordDate: string;
  description: string;
};

type SummaryRow = {
  recipientKey: string;
  recipientName: string;
  cumulativePoints: number;
  lastRecordDate?: string;
};

type SiteMemberOption = {
  _id: string;
  name: string;
  email: string;
};

type FormState = {
  userId: string;
  recipientName: string;
  category: SafetyMileageCategory;
  recordDate: string;
  description: string;
};

type DeleteTarget = {
  _id: string;
  title: string;
};

type TabKey = "records" | "summary";

const SITE_ID_KEY = "pmis:siteId";

function getTodayDateInput(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    userId: "",
    recipientName: "",
    category: DEFAULT_SAFETY_MILEAGE_CATEGORY,
    recordDate: getTodayDateInput(),
    description: "",
  };
}

function memberSummary(item: SiteMemberOption | null, fallbackName = ""): string {
  if (item) {
    return item.email ? `${item.name} · ${item.email}` : item.name;
  }
  return fallbackName;
}

function findUniqueMemberMatch(
  name: string,
  options: SiteMemberOption[],
): SiteMemberOption | null {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  const matched = options.filter((item) => item.name.trim().toLowerCase() === normalizedName);
  return matched.length === 1 ? matched[0] : null;
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4.167 13.333V15.833H6.667L14.042 8.458A1.178 1.178 0 0 0 14.042 6.792L13.208 5.958A1.178 1.178 0 0 0 11.542 5.958L4.167 13.333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10.833 6.667L13.333 9.167"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5.833 6.667V14.167C5.833 14.627 6.206 15 6.667 15H13.333C13.794 15 14.167 14.627 14.167 14.167V6.667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M4.167 5H15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8.333 5V4.167C8.333 3.707 8.706 3.333 9.167 3.333H10.833C11.294 3.333 11.667 3.707 11.667 4.167V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M8.333 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.667 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function MileageRewardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [tab, setTab] = useState<TabKey>("records");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberModalTarget, setMemberModalTarget] = useState<"create" | "edit" | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberOptions, setMemberOptions] = useState<SiteMemberOption[]>([]);
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const deferredMemberQuery = useDeferredValue(memberQuery);

  const selectedMember = memberOptions.find((item) => item._id === form.userId) ?? null;
  const editSelectedMember = memberOptions.find((item) => item._id === editForm.userId) ?? null;

  const filteredMembers = memberOptions.filter((item) => {
    const keyword = deferredMemberQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return item.name.toLowerCase().includes(keyword) || item.email.toLowerCase().includes(keyword);
  });

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }
    Promise.all([
      fetch(`/api/safety/mileage?siteId=${siteId}&limit=200`, { cache: "no-store" }).then((response) => response.json()),
      fetch(`/api/safety/mileage?siteId=${siteId}&mode=summary`, { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([recordResult, summaryResult]) => {
        if (recordResult.ok) {
          setRows(Array.isArray(recordResult.data) ? recordResult.data : []);
        }
        if (summaryResult.ok) {
          setSummaryRows(Array.isArray(summaryResult.data) ? summaryResult.data : []);
        }
      })
      .catch(() => {
        setError("안전 포인트 조회 실패");
      });
  }, []);

  const loadMembers = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    setIsMemberLoading(true);
    try {
      const response = await fetch(`/api/sites/members?siteId=${siteId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: SiteMemberOption[];
        error?: string;
      };

      if (!result.ok) {
        throw new Error(result.error ?? "현장 배치 사용자 조회 실패");
      }

      setMemberOptions(Array.isArray(result.data) ? result.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "현장 배치 사용자 조회 실패");
    } finally {
      setIsMemberLoading(false);
    }
  }, []);

  useEffect(() => {
    setError(null);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!showForm && !editingId) {
      return;
    }
    void loadMembers();
  }, [showForm, editingId, loadMembers]);

  useEffect(() => {
    if (!editingId || editForm.userId || !editForm.recipientName || memberOptions.length === 0) {
      return;
    }

    const matched = findUniqueMemberMatch(editForm.recipientName, memberOptions);
    if (!matched) {
      return;
    }

    setEditForm((prev) => {
      if (prev.userId || prev.recipientName !== editForm.recipientName) {
        return prev;
      }
      return {
        ...prev,
        userId: matched._id,
        recipientName: matched.name,
      };
    });
  }, [editingId, editForm.userId, editForm.recipientName, memberOptions]);

  function handleOpenMemberModal(target: "create" | "edit") {
    setMemberModalTarget(target);
    setMemberQuery("");
    setIsMemberModalOpen(true);
    if (memberOptions.length === 0) {
      void loadMembers();
    }
  }

  function handleCloseMemberModal() {
    if (isMemberLoading) {
      return;
    }
    setIsMemberModalOpen(false);
    setMemberModalTarget(null);
    setMemberQuery("");
  }

  function handleSelectMember(item: SiteMemberOption) {
    if (memberModalTarget === "edit") {
      setEditForm((prev) => ({
        ...prev,
        userId: item._id,
        recipientName: item.name,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        userId: item._id,
        recipientName: item.name,
      }));
    }
    setError(null);
    handleCloseMemberModal();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }
    if (!form.userId) {
      setError("수여대상을 선택하세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/safety/mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          userId: form.userId,
          category: form.category,
          recordDate: form.recordDate,
          description: form.description,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전 포인트 등록 실패");
      }

      setShowForm(false);
      setForm(emptyForm());
      setMessage("안전 포인트가 등록되었습니다.");
      fetchData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "안전 포인트 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(row: Row) {
    setEditingId(row._id);
    setEditForm({
      userId: row.userId ?? "",
      recipientName: row.recipientName ?? "",
      category: (row.category as SafetyMileageCategory) ?? DEFAULT_SAFETY_MILEAGE_CATEGORY,
      recordDate: row.recordDate?.slice(0, 10) ?? "",
      description: row.description ?? "",
    });
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    setEditForm(emptyForm());
  }

  async function handleUpdate() {
    if (!editingId) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }
    if (!editForm.userId) {
      setError("수여대상을 선택하세요.");
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/safety/mileage/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          userId: editForm.userId,
          category: editForm.category,
          recordDate: editForm.recordDate,
          description: editForm.description,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전 포인트 수정 실패");
      }

      handleCloseEditModal();
      setMessage("안전 포인트가 수정되었습니다.");
      fetchData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "안전 포인트 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(target: DeleteTarget) {
    setDeleteTarget(target);
    setError(null);
    setMessage(null);
  }

  function handleCloseDeleteModal() {
    if (deletingId) {
      return;
    }
    setDeleteTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/safety/mileage/${deleteTarget._id}?siteId=${encodeURIComponent(siteId)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전 포인트 삭제 실패");
      }

      setDeleteTarget(null);
      setMessage("안전 포인트가 삭제되었습니다.");
      fetchData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "안전 포인트 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Row>[] = [
    { key: "recipientName", header: "수여대상", className: "w-28" },
    { key: "category", header: "분류", className: "w-28" },
    {
      key: "recordDate",
      header: "기록일",
      className: "w-28",
      render: (_value, row) => row.recordDate?.slice(0, 10),
    },
    { key: "description", header: "설명" },
    {
      key: "_id",
      header: "관리",
      className: "w-24",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="rounded-md border border-border px-2 py-1 text-foreground hover:bg-background-soft"
            aria-label={`${row.recipientName} 포인트 수정`}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal({ _id: row._id, title: `${row.recipientName} / ${row.category}` })}
            className="rounded-md border border-border px-2 py-1 text-red-600 hover:bg-red-50"
            aria-label={`${row.recipientName} 포인트 삭제`}
          >
            <DeleteIcon />
          </button>
        </div>
      ),
    },
  ];

  const summaryColumns: DataTableColumn<SummaryRow>[] = [
    { key: "recipientName", header: "수여대상", className: "w-32" },
    {
      key: "cumulativePoints",
      header: "누적 포인트",
      className: "w-28 text-right",
      render: (_value, row) => `${row.cumulativePoints?.toLocaleString() ?? 0}점`,
    },
    {
      key: "lastRecordDate",
      header: "최근 적립일",
      className: "w-28",
      render: (_value, row) => row.lastRecordDate?.slice(0, 10) ?? "-",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">안전 포인트</h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setError(null);
            setMessage(null);
          }}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        <button
          type="button"
          onClick={() => setTab("records")}
          className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
            tab === "records"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-soft"
          }`}
        >
          기록
        </button>
        <button
          type="button"
          onClick={() => setTab("summary")}
          className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
            tab === "summary"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-soft"
          }`}
        >
          누적 현황
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-foreground">수여대상 *</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={memberSummary(selectedMember, form.recipientName)}
                  placeholder="현장 배치 사용자를 선택하세요"
                />
                <button
                  type="button"
                  onClick={() => handleOpenMemberModal("create")}
                  className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
                >
                  사용자 선택
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">기록일</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.recordDate}
                onChange={(event) => setForm((prev) => ({ ...prev, recordDate: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">분류 *</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value as SafetyMileageCategory }))
                }
              >
                {SAFETY_MILEAGE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-foreground">설명</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "records" ? (
        <DataTable columns={columns} data={rows} rowKey={(row) => row._id} emptyMessage="등록된 안전 포인트가 없습니다." />
      ) : (
        <DataTable
          columns={summaryColumns}
          data={summaryRows}
          rowKey={(row) => row.recipientKey}
          emptyMessage="누적 포인트 데이터가 없습니다."
        />
      )}

      <Modal open={editingId !== null} title="안전 포인트 수정" onClose={handleCloseEditModal}>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">수여대상 *</label>
            <div className="flex gap-2">
              <input
                readOnly
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={memberSummary(editSelectedMember, editForm.recipientName)}
                placeholder="현장 배치 사용자를 선택하세요"
              />
              <button
                type="button"
                onClick={() => handleOpenMemberModal("edit")}
                className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                사용자 선택
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">기록일</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.recordDate}
                onChange={(event) => setEditForm((prev) => ({ ...prev, recordDate: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">분류 *</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.category}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, category: event.target.value as SafetyMileageCategory }))
                }
              >
                {SAFETY_MILEAGE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-foreground">설명</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseEditModal}
              className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isUpdating}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteTarget !== null} title="안전 포인트 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            {deleteTarget ? `${deleteTarget.title} 포인트 기록을 삭제하시겠습니까?` : ""}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseDeleteModal}
              className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={isMemberModalOpen} title="현장 배치 사용자 선택" onClose={handleCloseMemberModal}>
        <div className="space-y-3">
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            placeholder="이름, 이메일로 검색"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
          />
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filteredMembers.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => handleSelectMember(item)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-background-soft"
              >
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-foreground-muted">{item.email || "이메일 없음"}</p>
              </button>
            ))}
            {!isMemberLoading && filteredMembers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-foreground-muted">
                선택 가능한 현장 배치 사용자가 없습니다.
              </p>
            ) : null}
            {isMemberLoading ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-foreground-muted">
                현장 배치 사용자를 불러오는 중...
              </p>
            ) : null}
          </div>
        </div>
      </Modal>
    </section>
  );
}

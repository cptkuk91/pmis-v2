"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";

type FacilityCondition = "good" | "fair" | "poor";
type FacilityTab = "standard" | "excellent";

type FacilityRow = {
  _id: string;
  name: string;
  location: string;
  installDate: string;
  condition: FacilityCondition;
  description: string;
};

type FacilityFormState = {
  name: string;
  location: string;
  installDate: string;
  condition: FacilityCondition;
  description: string;
};

type DeleteTarget = {
  _id: string;
  title: string;
};

const SITE_ID_KEY = "pmis:siteId";
const conditionLabel: Record<FacilityCondition, string> = {
  good: "양호",
  fair: "보통",
  poor: "불량",
};
const facilityTabLabel: Record<FacilityTab, string> = {
  standard: "표준 시설",
  excellent: "우수 사례",
};

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

function getKstTodayDateInput(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function emptyForm(): FacilityFormState {
  return {
    name: "",
    location: "",
    installDate: getKstTodayDateInput(),
    condition: "good",
    description: "",
  };
}

function parseTab(value: string | null): FacilityTab {
  return value === "excellent" ? "excellent" : "standard";
}

export default function SafetyFacilitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const activeTabLabel = facilityTabLabel[activeTab];

  const [data, setData] = useState<FacilityRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FacilityFormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FacilityFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setData([]);
      return;
    }

    fetch(`/api/safety/facilities?siteId=${siteId}&facilityType=${activeTab}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) {
          setData(Array.isArray(result.data) ? result.data : []);
        }
      })
      .catch(() => {
        setError("안전시설물 조회 실패");
      });
  }, [activeTab]);

  useEffect(() => {
    setShowForm(false);
    setForm(emptyForm());
    setEditingId(null);
    setEditForm(emptyForm());
    setDeleteTarget(null);
    setError(null);
    setMessage(null);
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleChangeTab(nextTab: FacilityTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    startTransition(() => {
      router.replace(`/quality-safety/safety/facilities?${params.toString()}`);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/safety/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId, facilityType: activeTab }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전시설물 등록 실패");
      }

      setShowForm(false);
      setForm(emptyForm());
      setMessage(`${activeTabLabel} 항목이 등록되었습니다.`);
      fetchData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "안전시설물 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(row: FacilityRow) {
    setEditingId(row._id);
    setEditForm({
      name: row.name ?? "",
      location: row.location ?? "",
      installDate: row.installDate?.slice(0, 10) ?? "",
      condition: row.condition ?? "good",
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

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/safety/facilities/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          ...editForm,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전시설물 수정 실패");
      }

      handleCloseEditModal();
      setMessage(`${activeTabLabel} 항목이 수정되었습니다.`);
      fetchData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "안전시설물 수정 실패");
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
      const response = await fetch(`/api/safety/facilities/${deleteTarget._id}?siteId=${encodeURIComponent(siteId)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전시설물 삭제 실패");
      }

      setDeleteTarget(null);
      setMessage(`${activeTabLabel} 항목이 삭제되었습니다.`);
      fetchData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "안전시설물 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<FacilityRow>[] = [
    { key: "name", header: "시설명" },
    { key: "location", header: "위치" },
    {
      key: "installDate",
      header: "설치일",
      className: "w-28",
      render: (_value, row) => row.installDate?.slice(0, 10),
    },
    {
      key: "condition",
      header: "상태",
      className: "w-20",
      render: (_value, row) => conditionLabel[row.condition] ?? row.condition,
    },
    {
      key: "description",
      header: "설명",
      render: (_value, row) => (row.description?.length > 40 ? `${row.description.slice(0, 40)}…` : row.description),
    },
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
            aria-label={`${row.name} 수정`}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal({ _id: row._id, title: row.name })}
            className="rounded-md border border-border px-2 py-1 text-red-600 hover:bg-red-50"
            aria-label={`${row.name} 삭제`}
          >
            <DeleteIcon />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">안전시설물</h1>
          <p className="text-sm text-foreground-muted">표준 시설과 우수 사례를 한 화면에서 구분해 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setError(null);
            setMessage(null);
          }}
          className="rounded-md bg-[#ecebe8] px-3 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-card p-1">
        {(["standard", "excellent"] as FacilityTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleChangeTab(tab)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeTab === tab
                ? "bg-[#ecebe8] font-medium text-foreground"
                : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
            }`}
          >
            {facilityTabLabel[tab]}
          </button>
        ))}
      </nav>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showForm ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background-card p-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">시설명</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="h-9 w-full rounded-md border border-border px-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">위치</span>
            <input
              required
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              className="h-9 w-full rounded-md border border-border px-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">설치일</span>
            <input
              required
              type="date"
              value={form.installDate}
              onChange={(event) => setForm((prev) => ({ ...prev, installDate: event.target.value }))}
              className="h-9 w-full rounded-md border border-border px-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">상태</span>
            <select
              value={form.condition}
              onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value as FacilityCondition }))}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="good">양호</option>
              <option value="fair">보통</option>
              <option value="poor">불량</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-foreground">설명</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="md:col-span-2">
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

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />

      <Modal open={editingId !== null} title={`${activeTabLabel} 수정`} onClose={handleCloseEditModal}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">시설명</span>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                className="h-9 w-full rounded-md border border-border px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">위치</span>
              <input
                value={editForm.location}
                onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                className="h-9 w-full rounded-md border border-border px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">설치일</span>
              <input
                type="date"
                value={editForm.installDate}
                onChange={(event) => setEditForm((prev) => ({ ...prev, installDate: event.target.value }))}
                className="h-9 w-full rounded-md border border-border px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">상태</span>
              <select
                value={editForm.condition}
                onChange={(event) => setEditForm((prev) => ({ ...prev, condition: event.target.value as FacilityCondition }))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="good">양호</option>
                <option value="fair">보통</option>
                <option value="poor">불량</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-foreground">설명</span>
              <textarea
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground"
              />
            </label>
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

      <Modal open={deleteTarget !== null} title={`${activeTabLabel} 삭제`} onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            {deleteTarget ? `${deleteTarget.title} 항목을 삭제하시겠습니까?` : ""}
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
    </section>
  );
}

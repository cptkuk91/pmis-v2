"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable, FormInput, Modal, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type MeetingItem = {
  _id: string;
  category: string;
  agenda: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  host: string;
  minutes?: string;
};

type MeetingFormState = {
  category: string;
  agenda: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  host: string;
};

type MeetingResponse = {
  ok: boolean;
  data: MeetingItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type DeleteTarget = Pick<MeetingItem, "_id" | "agenda">;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR");
}

function toDateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatLocalDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createMeetingForm(item?: MeetingItem): MeetingFormState {
  return {
    category: item?.category ?? "",
    agenda: item?.agenda ?? "",
    meetingDate: item ? toDateInputValue(item.meetingDate) : formatLocalDateValue(new Date()),
    startTime: item?.startTime ?? "09:00",
    endTime: item?.endTime ?? "10:00",
    location: item?.location ?? "회의실",
    host: item?.host ?? "",
  };
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
      <path d="M10.833 6.667L13.333 9.167" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

export default function DashboardMeetingsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = hasMinRole(user.role, "manager");

  const [items, setItems] = useState<MeetingItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MeetingFormState>(createMeetingForm);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMeetings = useCallback(async (nextPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const today = formatLocalDateValue(new Date());
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "10",
        dateFrom: today,
        dateTo: today,
      });
      const response = await fetch(`/api/meetings?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as MeetingResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "회의 조회 실패");
      }
      setItems(result.data);
      setPage(result.meta?.page ?? 1);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings(1);
  }, [loadMeetings]);

  function handleOpenEditModal(item: MeetingItem) {
    setEditingMeetingId(item._id);
    setEditForm(createMeetingForm(item));
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }

    setEditingMeetingId(null);
    setEditForm(createMeetingForm());
  }

  async function handleUpdate() {
    if (!editingMeetingId) {
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/meetings/${editingMeetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "회의 수정 실패");
      }

      handleCloseEditModal();
      setMessage("회의가 수정되었습니다.");
      await loadMeetings(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(item: MeetingItem) {
    setDeleteTarget({ _id: item._id, agenda: item.agenda });
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

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/meetings/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "회의 삭제 실패");
      }

      if (editingMeetingId === deleteTarget._id) {
        handleCloseEditModal();
      }
      setDeleteTarget(null);
      setMessage("회의가 삭제되었습니다.");
      await loadMeetings(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">금일 회의</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            오늘 등록된 회의 현황은 여기서 확인하고, 등록/시간 설정은 공통 회의 관리에서 진행합니다.
          </p>
        </div>
        {canManage ? (
          <Link
            href="/system-admin/common/meetings?tab=meetings"
            className="inline-flex rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
          >
            회의 등록
          </Link>
        ) : null}
      </header>

      {canManage ? (
        <div className="rounded-xl border border-border bg-background-soft px-4 py-4">
          <p className="text-sm font-medium text-foreground">회의 등록과 시간 설정</p>
          <p className="mt-1 text-sm text-foreground-muted">
            신규 등록은 공통 회의 관리 화면에서 진행하고, 이 화면에서는 등록된 회의를 바로 수정/삭제할 수 있습니다.
          </p>
        </div>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">회의 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<MeetingItem>
        columns={[
          { key: "category", header: "구분", className: "w-32" },
          { key: "agenda", header: "안건" },
          {
            key: "meetingDate",
            header: "일자",
            className: "w-32",
            render: (value) => formatDate(String(value)),
          },
          {
            key: "startTime",
            header: "시간",
            className: "w-32",
            render: (value, row) => `${String(value)} ~ ${row.endTime}`,
          },
          { key: "location", header: "장소", className: "w-32" },
          { key: "host", header: "주관", className: "w-24" },
          ...(canManage
            ? [
                {
                  key: "_id" as const,
                  header: "관리",
                  className: "w-28",
                  render: (_value: string | undefined, row: MeetingItem) => (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(row)}
                        aria-label="회의 수정"
                        title="수정"
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(row)}
                        aria-label="회의 삭제"
                        title="삭제"
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-danger/40 text-danger hover:bg-danger/10"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "회의 데이터가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadMeetings(nextPage)} />

      <Modal open={Boolean(editingMeetingId)} title="회의 수정" onClose={handleCloseEditModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUpdate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormInput
              label="회의구분"
              value={editForm.category}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, category: event.target.value }))
              }
              required
            />
            <FormInput
              label="안건"
              value={editForm.agenda}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, agenda: event.target.value }))
              }
              required
            />
            <FormInput
              label="회의일자"
              type="date"
              value={editForm.meetingDate}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, meetingDate: event.target.value }))
              }
              required
            />
            <FormInput
              label="장소"
              value={editForm.location}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, location: event.target.value }))
              }
            />
            <FormInput
              label="시작시간"
              type="time"
              value={editForm.startTime}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, startTime: event.target.value }))
              }
            />
            <FormInput
              label="종료시간"
              type="time"
              value={editForm.endTime}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, endTime: event.target.value }))
              }
            />
            <FormInput
              label="주관"
              value={editForm.host}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, host: event.target.value }))
              }
              wrapperClassName="md:col-span-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseEditModal}
              disabled={isUpdating}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="회의 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{deleteTarget?.agenda}</strong> 회의를 삭제하시겠습니까?
          </p>
          <p className="text-sm text-foreground-muted">삭제 후에는 목록에서 보이지 않습니다.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseDeleteModal}
              disabled={Boolean(deletingId)}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={Boolean(deletingId)}
              className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

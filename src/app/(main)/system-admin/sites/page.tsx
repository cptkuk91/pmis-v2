"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import { getNextSiteCode } from "@/lib/site-code";

type SiteRow = {
  _id: string;
  siteCode: string;
  siteName: string;
  address?: string;
  status: "active" | "completed" | "suspended";
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
  projectManager?: {
    _id: string;
    name: string;
    email: string;
  } | null;
};

type SitesResponse = {
  ok: boolean;
  data: SiteRow[];
  error?: string;
};

type UserOption = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type SiteMembershipLookupResponse = {
  ok: boolean;
  data: {
    users: UserOption[];
  };
  error?: string;
};

type SiteMutationResponse = {
  ok: boolean;
  data?: SiteRow;
  error?: string;
};

type SiteDeleteTarget = Pick<SiteRow, "_id" | "siteCode" | "siteName">;
type SiteDelegateTarget = Pick<SiteRow, "_id" | "siteCode" | "siteName" | "projectManager">;

type SiteFormState = {
  siteName: string;
  address: string;
  status: SiteRow["status"];
  startDate: string;
  endDate: string;
  description: string;
};

const emptySiteForm: SiteFormState = {
  siteName: "",
  address: "",
  status: "active",
  startDate: "",
  endDate: "",
  description: "",
};

function normalizeDateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
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
      <path d="M5.833 6.667V14.167C5.833 14.627 6.206 15 6.667 15H13.333C13.794 15 14.167 14.627 14.167 14.167V6.667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.167 5H15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.333 5V4.167C8.333 3.707 8.706 3.333 9.167 3.333H10.833C11.294 3.333 11.667 3.707 11.667 4.167V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.333 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.667 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DelegateIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M10 10.833C11.841 10.833 13.333 9.341 13.333 7.5C13.333 5.659 11.841 4.167 10 4.167C8.159 4.167 6.667 5.659 6.667 7.5C6.667 9.341 8.159 10.833 10 10.833Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.583 15.833C5.62 13.892 7.635 12.917 10 12.917C12.365 12.917 14.38 13.892 15.417 15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.417 5.417H12.917" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.167 4.167L15.417 5.417L14.167 6.667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SiteManagementPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "super_admin"), [user.role]);
  const [items, setItems] = useState<SiteRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteDeleteTarget | null>(null);
  const [delegateTarget, setDelegateTarget] = useState<SiteDelegateTarget | null>(null);
  const [delegateUserId, setDelegateUserId] = useState("");
  const [delegateQuery, setDelegateQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<SiteFormState>(emptySiteForm);
  const [editForm, setEditForm] = useState<SiteFormState>(emptySiteForm);
  const nextSiteCode = getNextSiteCode(items.map((item) => item.siteCode));
  const filteredUsers = useMemo(() => {
    const keyword = delegateQuery.trim().toLowerCase();
    if (!keyword) {
      return users;
    }

    return users.filter((item) => {
      const name = item.name.toLowerCase();
      const email = item.email.toLowerCase();
      const role = item.role.toLowerCase();
      return name.includes(keyword) || email.includes(keyword) || role.includes(keyword);
    });
  }, [delegateQuery, users]);

  const loadSites = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sitesResponse, membershipsResponse] = await Promise.all([
        fetch("/api/sites", { cache: "no-store" }),
        canManage
          ? fetch("/api/system/site-memberships?includeInactive=1", { cache: "no-store" })
          : Promise.resolve(null),
      ]);

      const result = (await sitesResponse.json()) as SitesResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장 목록 조회 실패");
      }
      setItems(result.data);

      if (membershipsResponse) {
        const membershipResult = (await membershipsResponse.json()) as SiteMembershipLookupResponse;
        if (!membershipResult.ok) {
          throw new Error(membershipResult.error ?? "사용자 목록 조회 실패");
        }
        setUsers(Array.isArray(membershipResult.data.users) ? membershipResult.data.users : []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 목록 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (!isUserLoading) {
      void loadSites();
    }
  }, [isUserLoading, loadSites]);

  function handleEdit(item: SiteRow) {
    setEditingId(item._id);
    setEditForm({
      siteName: item.siteName,
      address: item.address ?? "",
      status: item.status,
      startDate: normalizeDateInput(item.startDate),
      endDate: normalizeDateInput(item.endDate),
      description: item.description ?? "",
    });
    setError(null);
    setMessage(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditForm(emptySiteForm);
  }

  function handleOpenDeleteModal(item: SiteRow) {
    setDeleteTarget({
      _id: item._id,
      siteCode: item.siteCode,
      siteName: item.siteName,
    });
    setDelegateTarget(null);
    setError(null);
    setMessage(null);
  }

  function handleCloseDeleteModal() {
    if (deletingId) {
      return;
    }
    setDeleteTarget(null);
  }

  function handleOpenDelegateModal(item: SiteRow) {
    setDelegateTarget({
      _id: item._id,
      siteCode: item.siteCode,
      siteName: item.siteName,
      projectManager: item.projectManager ?? null,
    });
    setDelegateUserId(item.projectManager?._id ?? "");
    setDelegateQuery("");
    setDeleteTarget(null);
    setError(null);
    setMessage(null);
  }

  function handleCloseDelegateModal() {
    if (isDelegating) {
      return;
    }
    setDelegateTarget(null);
    setDelegateUserId("");
    setDelegateQuery("");
  }

  async function handleCreateSite() {
    if (!canManage) {
      setError("현장 생성 권한이 없습니다.");
      return;
    }

    if (!form.siteName.trim()) {
      setError("현장명은 필수입니다.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: form.siteName.trim(),
          address: form.address.trim(),
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          description: form.description.trim(),
        }),
      });
      const result = (await response.json()) as SiteMutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장 생성 실패");
      }

      setForm(emptySiteForm);
      const createdSiteCode = result.data?.siteCode ?? nextSiteCode;
      setMessage(`현장이 생성되었습니다. (${createdSiteCode}) 상단 현장 전환에서 선택할 수 있습니다.`);
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 생성 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateSite() {
    if (!canManage || !editingId) {
      return;
    }

    if (!editForm.siteName.trim()) {
      setError("현장명은 필수입니다.");
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: editForm.siteName.trim(),
          address: editForm.address.trim(),
          status: editForm.status,
          startDate: editForm.startDate || null,
          endDate: editForm.endDate || null,
          description: editForm.description.trim(),
        }),
      });
      const result = (await response.json()) as SiteMutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장 수정 실패");
      }

      setEditingId(null);
      setEditForm(emptySiteForm);
      setMessage("현장 정보가 수정되었습니다.");
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteSite() {
    if (!canManage || !deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as SiteMutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        handleCancelEdit();
      }
      setDeleteTarget(null);
      setMessage("현장이 삭제되었습니다.");
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDelegateProjectManager() {
    if (!canManage || !delegateTarget) {
      return;
    }

    if (!delegateUserId) {
      setError("위임할 사용자를 선택해 주세요.");
      return;
    }

    setIsDelegating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${delegateTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectManager: delegateUserId,
          delegateProjectManager: true,
        }),
      });
      const result = (await response.json()) as SiteMutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장소장 위임 실패");
      }

      setDelegateTarget(null);
      setDelegateUserId("");
      setDelegateQuery("");
      setMessage("현장소장이 위임되었습니다.");
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장소장 위임 실패");
    } finally {
      setIsDelegating(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">현장 등록/관리</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          최고 관리자 권한으로 신규 현장을 생성하고 상태를 관리합니다.
        </p>
      </header>

      {!canManage ? (
        <div className="rounded-md border border-border bg-background-soft p-3 text-sm text-foreground-muted">
          현재 계정은 현장 생성 권한(`super_admin`)이 없습니다.
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-border bg-background-soft p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">현장코드 *</span>
              <input
                value={nextSiteCode}
                disabled
                readOnly
                className="h-9 w-full cursor-not-allowed rounded-md border border-border bg-background px-3 text-sm text-foreground-muted disabled:opacity-100"
              />
              <span className="block text-xs text-foreground-muted">현장 생성 시 서버에서 자동으로 다음 코드가 부여됩니다.</span>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">현장명 *</span>
              <input
                value={form.siteName}
                onChange={(event) => setForm((prev) => ({ ...prev, siteName: event.target.value }))}
                placeholder="예: 로얄팰리스"
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">주소</span>
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as SiteRow["status"] }))
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="active">진행중</option>
                <option value="completed">완료</option>
                <option value="suspended">중지</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">착공일</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">준공일</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">설명</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleCreateSite()}
              className="rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-60"
            >
              현장 생성
            </button>
          </div>
        </div>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-background-soft text-left text-foreground-muted">
            <tr>
              <th className="px-3 py-2">현장코드</th>
              <th className="px-3 py-2">현장명</th>
              <th className="px-3 py-2">주소</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">현장소장</th>
              {canManage ? <th className="px-3 py-2">관리</th> : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-3 py-3 text-foreground-muted" colSpan={canManage ? 6 : 5}>
                  현장 목록 로딩 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-foreground-muted" colSpan={canManage ? 6 : 5}>
                  등록된 현장이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <Fragment key={item._id}>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium text-foreground">{item.siteCode}</td>
                    <td className="px-3 py-2 text-foreground">
                      {editingId === item._id ? (
                        <input
                          value={editForm.siteName}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, siteName: event.target.value }))}
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        />
                      ) : (
                        item.siteName
                      )}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {editingId === item._id ? (
                        <input
                          value={editForm.address}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        />
                      ) : (
                        item.address || "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {editingId === item._id ? (
                        <select
                          value={editForm.status}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              status: event.target.value as SiteRow["status"],
                            }))
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          <option value="active">진행중</option>
                          <option value="completed">완료</option>
                          <option value="suspended">중지</option>
                        </select>
                      ) : (
                        item.status
                      )}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {item.projectManager ? (
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">{item.projectManager.name}</p>
                          <p className="text-xs text-foreground-muted">{item.projectManager.email}</p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        {editingId === item._id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => void handleUpdateSite()}
                              className="rounded border border-border bg-background-card px-2 py-1 text-xs text-foreground hover:bg-background-soft disabled:opacity-60"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={handleCancelEdit}
                              className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft disabled:opacity-60"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              aria-label="현장 수정"
                              title="현장 수정"
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              disabled={isDelegating}
                              onClick={() => handleOpenDelegateModal(item)}
                              aria-label="현장소장 위임"
                              title="현장소장 위임"
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft disabled:opacity-60"
                            >
                              <DelegateIcon />
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === item._id}
                              onClick={() => handleOpenDeleteModal(item)}
                              aria-label="현장 삭제"
                              title="현장 삭제"
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-60"
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                  {editingId === item._id ? (
                    <tr className="border-t border-border bg-background-soft/50">
                      <td className="px-3 py-3 text-xs font-medium text-foreground-muted">추가 정보</td>
                      <td className="px-3 py-3" colSpan={canManage ? 5 : 4}>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_1fr]">
                          <label className="space-y-1">
                            <span className="block text-xs font-medium text-foreground-muted">착공일</span>
                            <input
                              type="date"
                              value={editForm.startDate}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-xs font-medium text-foreground-muted">준공일</span>
                            <input
                              type="date"
                              value={editForm.endDate}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-xs font-medium text-foreground-muted">설명</span>
                            <textarea
                              rows={2}
                              value={editForm.description}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground"
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Modal open={deleteTarget !== null} title="현장 삭제 확인" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background-soft p-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{deleteTarget?.siteCode}</span>
              {" · "}
              <span>{deleteTarget?.siteName}</span>
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              삭제 후에는 현장 목록에서 제외되고, 연결된 활성 사용자 배정도 함께 비활성화됩니다.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(deletingId)}
              onClick={handleCloseDeleteModal}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              disabled={Boolean(deletingId)}
              onClick={() => void handleDeleteSite()}
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger hover:bg-danger/15 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={delegateTarget !== null} title="현장소장 위임" onClose={handleCloseDelegateModal}>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background-soft p-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{delegateTarget?.siteCode}</span>
              {" · "}
              <span>{delegateTarget?.siteName}</span>
            </p>
            <p className="mt-2 text-xs font-medium text-foreground-muted">현재 현장소장</p>
            <p className="mt-1 text-sm text-foreground">
              {delegateTarget?.projectManager
                ? `${delegateTarget.projectManager.name} (${delegateTarget.projectManager.email})`
                : "미지정"}
            </p>
          </div>
          <div className="space-y-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">사용자 검색</span>
              <input
                value={delegateQuery}
                onChange={(event) => setDelegateQuery(event.target.value)}
                placeholder="이름, 이메일, 역할로 검색"
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">위임 대상</span>
              <select
                value={delegateUserId}
                onChange={(event) => setDelegateUserId(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="">사용자를 선택해 주세요.</option>
                {filteredUsers.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} ({item.email}) · {item.role}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-foreground-muted">
              위임하면 선택한 사용자는 이 현장의 `site_admin` 권한을 받고, 기존 현장소장은 `manager`로 조정됩니다.
            </p>
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-danger">검색 조건에 맞는 사용자가 없습니다.</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isDelegating}
              onClick={handleCloseDelegateModal}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!delegateUserId || isDelegating}
              onClick={() => void handleDelegateProjectManager()}
              className="rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-60"
            >
              {isDelegating ? "위임 중..." : "위임"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

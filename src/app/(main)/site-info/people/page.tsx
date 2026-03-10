"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";

type PersonnelRow = {
  _id: string;
  userId?: string | null;
  name: string;
  company: string;
  position: string;
  role: string;
  phone: string;
  email: string;
  category: string;
  actions?: string;
};

type SiteMemberOption = {
  _id: string;
  name: string;
  email: string;
  role: "super_admin" | "site_admin" | "manager" | "viewer";
  membershipRole: "site_admin" | "manager" | "viewer";
};

type PersonnelFormState = {
  userId: string;
  name: string;
  company: string;
  position: string;
  role: string;
  phone: string;
  email: string;
};

type MemberModalTarget = "create" | "edit" | null;

type DeleteTarget = {
  _id: string;
  name: string;
};

const SITE_ID_KEY = "pmis:siteId";

const tabs = [
  { key: "constructor", label: "시공사" },
  { key: "partner", label: "관련사" },
  { key: "government", label: "관공서" },
] as const;

const emptyForm = (): PersonnelFormState => ({
  userId: "",
  name: "",
  company: "",
  position: "",
  role: "",
  phone: "",
  email: "",
});

function memberSummary(member: SiteMemberOption | null, fallbackName = "", fallbackEmail = ""): string {
  if (member) {
    return member.email ? `${member.name} · ${member.email}` : member.name;
  }
  if (fallbackName) {
    return fallbackEmail ? `${fallbackName} · ${fallbackEmail}` : fallbackName;
  }
  return "";
}

export default function PeoplePage() {
  const [tab, setTab] = useState<string>("constructor");
  const [data, setData] = useState<PersonnelRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PersonnelFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PersonnelFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [memberOptions, setMemberOptions] = useState<SiteMemberOption[]>([]);
  const [memberModalTarget, setMemberModalTarget] = useState<MemberModalTarget>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedMember = memberOptions.find((item) => item._id === form.userId) ?? null;
  const editSelectedMember = memberOptions.find((item) => item._id === editForm.userId) ?? null;
  const filteredMembers = memberOptions.filter((item) => {
    const keyword = memberQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return item.name.toLowerCase().includes(keyword) || item.email.toLowerCase().includes(keyword);
  });

  const fetchData = useCallback((nextPage: number, category: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    fetch(`/api/sites/personnel?siteId=${siteId}&category=${category}&page=${nextPage}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.error ?? "관계자 현황 조회 실패");
        }

        setData(Array.isArray(result.data) ? result.data : []);
        setTotalPages(result.meta?.totalPages ?? 1);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "관계자 현황 조회 실패");
      });
  }, []);

  const loadMembers = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    setIsMemberLoading(true);
    try {
      const response = await fetch(`/api/sites/members?siteId=${siteId}`, { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: SiteMemberOption[];
        error?: string;
      };

      if (!result.ok) {
        throw new Error(result.error ?? "현장 배치 근무자 조회 실패");
      }

      setMemberOptions(Array.isArray(result.data) ? result.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "현장 배치 근무자 조회 실패");
    } finally {
      setIsMemberLoading(false);
    }
  }, []);

  useEffect(() => {
    setError(null);
    fetchData(page, tab);
  }, [page, tab, fetchData]);

  useEffect(() => {
    if (!showForm && !editingId) {
      return;
    }
    void loadMembers();
  }, [showForm, editingId, loadMembers]);

  function handleTabChange(key: string) {
    setTab(key);
    setPage(1);
    setError(null);
    setMessage(null);
  }

  function handleOpenMemberModal(target: MemberModalTarget) {
    if (!target) {
      return;
    }
    setError(null);
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

  function handleSelectMember(member: SiteMemberOption) {
    if (memberModalTarget === "edit") {
      setEditForm((prev) => ({
        ...prev,
        userId: member._id,
        name: member.name,
        company: "",
        position: "",
        email: member.email,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        userId: member._id,
        name: member.name,
        company: "",
        position: "",
        email: member.email,
      }));
    }

    handleCloseMemberModal();
  }

  function handleOpenEditModal(row: PersonnelRow) {
    setError(null);
    setMessage(null);
    setEditingId(row._id);
    setEditForm({
      userId: row.userId ? String(row.userId) : "",
      name: row.name ?? "",
      company: row.company ?? "",
      position: row.position ?? "",
      role: row.role ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
    });
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    setEditForm(emptyForm());
  }

  function handleOpenDeleteModal(row: PersonnelRow) {
    setError(null);
    setMessage(null);
    setDeleteTarget({ _id: row._id, name: row.name });
  }

  function handleCloseDeleteModal() {
    if (deletingId) {
      return;
    }
    setDeleteTarget(null);
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }
    if (!form.name.trim()) {
      setError(form.userId ? "관계자를 선택해 주세요." : "성명을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/sites/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId, category: tab }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(result.error ?? "관계자 등록 실패");
      }

      setShowForm(false);
      setForm(emptyForm());
      setMessage("관계자가 등록되었습니다.");
      fetchData(1, tab);
      setPage(1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "관계자 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }
    if (!editingId) {
      return;
    }
    if (!editForm.name.trim()) {
      setError(editForm.userId ? "관계자를 선택해 주세요." : "성명을 입력해 주세요.");
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/sites/personnel/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, siteId, category: tab }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(result.error ?? "관계자 수정 실패");
      }

      setEditingId(null);
      setEditForm(emptyForm());
      setMessage("관계자가 수정되었습니다.");
      fetchData(page, tab);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "관계자 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }
    if (!deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/sites/personnel/${deleteTarget._id}?siteId=${siteId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(result.error ?? "관계자 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        setEditingId(null);
        setEditForm(emptyForm());
      }

      setDeleteTarget(null);
      setMessage("관계자가 삭제되었습니다.");
      fetchData(page, tab);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "관계자 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<PersonnelRow>[] = [
    { key: "name", header: "성명", className: "w-24" },
    { key: "company", header: "소속" },
    { key: "position", header: "직위", className: "w-20" },
    { key: "role", header: "담당업무" },
    { key: "phone", header: "연락처", className: "w-32" },
    { key: "email", header: "이메일" },
    {
      key: "actions",
      header: "관리",
      className: "w-32",
      render: (_value, row) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleOpenEditModal(row)}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal(row)}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            삭제
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">관계자 현황</h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setError(null);
            setMessage(null);
            if (showForm) {
              setForm(emptyForm());
            }
          }}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleTabChange(item.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              tab === item.key
                ? "bg-[#ecebe8] font-medium text-foreground"
                : "text-foreground-muted hover:bg-background-soft"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">현장 배치 근무자</label>
            <div className="flex flex-wrap gap-2">
              <input
                readOnly
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={memberSummary(selectedMember, form.name, form.email)}
                placeholder="선택하지 않으면 아래 성명/이메일을 직접 입력할 수 있습니다."
              />
              <button
                type="button"
                onClick={() => handleOpenMemberModal("create")}
                className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                근무자 선택
              </button>
              {form.userId ? (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, userId: "" }))}
                  className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
                >
                  선택 해제
                </button>
              ) : null}
            </div>
            <p className="text-xs text-foreground-muted">
              선택한 근무자의 성명과 이메일만 반영합니다. 소속과 직위는 현재 연동 데이터가 없어 기본값을 비워 둡니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">성명 *</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.name}
                readOnly={Boolean(form.userId)}
                onChange={(event) => setForm((prev) => ({ ...prev, userId: "", name: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">소속</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.company}
                placeholder={form.userId ? "연동 데이터 없음" : ""}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">직위</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.position}
                placeholder={form.userId ? "연동 데이터 없음" : ""}
                onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">담당업무</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">연락처</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">이메일</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.email}
                readOnly={Boolean(form.userId)}
                onChange={(event) => setForm((prev) => ({ ...prev, userId: "", email: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} emptyMessage="등록된 관계자가 없습니다." />
      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal open={editingId !== null} title="관계자 수정" onClose={handleCloseEditModal}>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">현장 배치 근무자</label>
            <div className="flex flex-wrap gap-2">
              <input
                readOnly
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={memberSummary(editSelectedMember, editForm.name, editForm.email)}
                placeholder="선택하지 않으면 아래 성명/이메일을 직접 입력할 수 있습니다."
              />
              <button
                type="button"
                onClick={() => handleOpenMemberModal("edit")}
                className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                근무자 선택
              </button>
              {editForm.userId ? (
                <button
                  type="button"
                  onClick={() => setEditForm((prev) => ({ ...prev, userId: "" }))}
                  className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
                >
                  선택 해제
                </button>
              ) : null}
            </div>
            <p className="text-xs text-foreground-muted">
              선택한 근무자의 성명과 이메일만 반영합니다. 소속과 직위는 현재 연동 데이터가 없어 기본값을 비워 둡니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">성명 *</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.name}
                readOnly={Boolean(editForm.userId)}
                onChange={(event) => setEditForm((prev) => ({ ...prev, userId: "", name: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">소속</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.company}
                placeholder={editForm.userId ? "연동 데이터 없음" : ""}
                onChange={(event) => setEditForm((prev) => ({ ...prev, company: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">직위</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.position}
                placeholder={editForm.userId ? "연동 데이터 없음" : ""}
                onChange={(event) => setEditForm((prev) => ({ ...prev, position: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">담당업무</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.role}
                onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">연락처</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.phone}
                onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">이메일</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={editForm.email}
                readOnly={Boolean(editForm.userId)}
                onChange={(event) => setEditForm((prev) => ({ ...prev, userId: "", email: event.target.value }))}
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
              onClick={() => void handleUpdate()}
              disabled={isUpdating}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteTarget !== null} title="관계자 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            {deleteTarget ? (
              <>
                <strong>{deleteTarget.name}</strong> 관계자를 삭제하시겠습니까?
              </>
            ) : null}
          </p>
          <p className="text-sm text-foreground-muted">삭제 후에는 목록에서 보이지 않습니다.</p>
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
              onClick={() => void handleDelete()}
              disabled={deletingId !== null}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={isMemberModalOpen} title="현장 배치 근무자 선택" onClose={handleCloseMemberModal}>
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
                선택 가능한 현장 배치 근무자가 없습니다.
              </p>
            ) : null}
            {isMemberLoading ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-foreground-muted">
                현장 배치 근무자를 불러오는 중...
              </p>
            ) : null}
          </div>
        </div>
      </Modal>
    </section>
  );
}

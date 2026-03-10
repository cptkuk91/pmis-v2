"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";

type VisitorRow = {
  _id: string;
  visitorName: string;
  company: string;
  purpose: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime: string;
  contactUserId?: string | null;
  contactPerson: string;
  phone: string;
  vehicleNo: string;
  actions?: string;
};

type SiteMemberOption = {
  _id: string;
  name: string;
  email: string;
  role: "super_admin" | "site_admin" | "manager" | "viewer";
  membershipRole: "site_admin" | "manager" | "viewer";
};

type VisitorFormState = {
  visitorName: string;
  company: string;
  purpose: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime: string;
  contactUserId: string;
  contactPerson: string;
  phone: string;
  vehicleNo: string;
};

type DeleteTarget = {
  _id: string;
  visitorName: string;
};

const SITE_ID_KEY = "pmis:siteId";

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKorean(value: string): string {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return "";
  }

  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function createDefaultForm(): VisitorFormState {
  return {
    visitorName: "",
    company: "",
    purpose: "",
    visitDate: getTodayDateInputValue(),
    checkInTime: "09:00",
    checkOutTime: "18:00",
    contactUserId: "",
    contactPerson: "",
    phone: "",
    vehicleNo: "",
  };
}

function memberSummary(member: SiteMemberOption | null, fallbackName = ""): string {
  if (member) {
    return member.email ? `${member.name} · ${member.email}` : member.name;
  }
  return fallbackName;
}

const baseColumns: DataTableColumn<VisitorRow>[] = [
  {
    key: "visitDate",
    header: "방문일",
    className: "w-28",
    render: (value) => (value ? new Date(String(value)).toLocaleDateString("ko-KR") : "-"),
  },
  { key: "visitorName", header: "방문자", className: "w-24" },
  { key: "company", header: "소속" },
  { key: "purpose", header: "방문목적" },
  { key: "checkInTime", header: "입장", className: "w-16" },
  { key: "checkOutTime", header: "퇴장", className: "w-16" },
  { key: "contactPerson", header: "면담자", className: "w-24" },
  { key: "vehicleNo", header: "차량번호", className: "w-28" },
];

function buildActionColumn(
  onEdit: (row: VisitorRow) => void,
  onDelete: (row: VisitorRow) => void,
): DataTableColumn<VisitorRow> {
  return {
    key: "actions",
    header: "관리",
    className: "w-32",
    render: (_value, row) => (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(row)}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete(row)}
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          삭제
        </button>
      </div>
    ),
  };
}

type VisitorFormFieldsProps = {
  form: VisitorFormState;
  memberText: string;
  onChange: (patch: Partial<VisitorFormState>) => void;
  onOpenMemberModal: () => void;
  onClearMember: () => void;
};

function VisitorFormFields({
  form,
  memberText,
  onChange,
  onOpenMemberModal,
  onClearMember,
}: VisitorFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">방문자명 *</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.visitorName}
          onChange={(event) => onChange({ visitorName: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">소속</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.company}
          onChange={(event) => onChange({ company: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">방문일 *</label>
        <input
          type="date"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.visitDate}
          onChange={(event) => onChange({ visitDate: event.target.value })}
        />
        <p className="text-xs text-foreground-muted">{formatDateKorean(form.visitDate)}</p>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">방문목적 *</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.purpose}
          onChange={(event) => onChange({ purpose: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">입장시간</label>
        <input
          type="time"
          step={600}
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.checkInTime}
          onChange={(event) => onChange({ checkInTime: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">퇴장시간</label>
        <input
          type="time"
          step={600}
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.checkOutTime}
          onChange={(event) => onChange({ checkOutTime: event.target.value })}
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="block text-sm font-medium text-foreground">면담자</label>
        <div className="flex flex-wrap gap-2">
          <input
            readOnly
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            value={memberText}
            placeholder="현장 배치 인력 중 면담자를 선택하세요."
          />
          <button
            type="button"
            onClick={onOpenMemberModal}
            className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            면담자 선택
          </button>
          {form.contactUserId ? (
            <button
              type="button"
              onClick={onClearMember}
              className="shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              선택 해제
            </button>
          ) : null}
        </div>
        <p className="text-xs text-foreground-muted">면담자는 현장 배치 인력 중에서 선택합니다.</p>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">연락처</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">차량번호</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.vehicleNo}
          onChange={(event) => onChange({ vehicleNo: event.target.value })}
        />
      </div>
    </div>
  );
}

export default function VisitorsPage() {
  const [data, setData] = useState<VisitorRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<VisitorFormState>(createDefaultForm);
  const [editForm, setEditForm] = useState<VisitorFormState>(createDefaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [memberOptions, setMemberOptions] = useState<SiteMemberOption[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberModalMode, setMemberModalMode] = useState<"create" | "edit">("create");
  const [memberQuery, setMemberQuery] = useState("");
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedMember = memberOptions.find((item) => item._id === form.contactUserId) ?? null;
  const selectedEditMember = memberOptions.find((item) => item._id === editForm.contactUserId) ?? null;
  const filteredMembers = memberOptions.filter((item) => {
    const keyword = memberQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return item.name.toLowerCase().includes(keyword) || item.email.toLowerCase().includes(keyword);
  });

  const fetchData = useCallback((nextPage: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    fetch(`/api/sites/visitors?siteId=${siteId}&page=${nextPage}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.error ?? "방문자 목록 조회 실패");
        }

        setData(Array.isArray(result.data) ? result.data : []);
        setTotalPages(result.meta?.totalPages ?? 1);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "방문자 목록 조회 실패");
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
        throw new Error(result.error ?? "현장 배치 인력 조회 실패");
      }

      setMemberOptions(Array.isArray(result.data) ? result.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "현장 배치 인력 조회 실패");
    } finally {
      setIsMemberLoading(false);
    }
  }, []);

  useEffect(() => {
    setError(null);
    fetchData(page);
  }, [page, fetchData]);

  useEffect(() => {
    if (!showForm && !editingId) {
      return;
    }
    void loadMembers();
  }, [showForm, editingId, loadMembers]);

  function handleOpenMemberModal(mode: "create" | "edit") {
    setError(null);
    setMemberQuery("");
    setMemberModalMode(mode);
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
    setMemberQuery("");
  }

  function handleSelectMember(member: SiteMemberOption) {
    if (memberModalMode === "edit") {
      setEditForm((prev) => ({
        ...prev,
        contactUserId: member._id,
        contactPerson: member.name,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        contactUserId: member._id,
        contactPerson: member.name,
      }));
    }
    handleCloseMemberModal();
  }

  function handleOpenEditModal(row: VisitorRow) {
    setEditForm({
      visitorName: row.visitorName ?? "",
      company: row.company ?? "",
      purpose: row.purpose ?? "",
      visitDate: row.visitDate ? String(row.visitDate).slice(0, 10) : getTodayDateInputValue(),
      checkInTime: row.checkInTime ?? "09:00",
      checkOutTime: row.checkOutTime ?? "18:00",
      contactUserId: row.contactUserId ?? "",
      contactPerson: row.contactPerson ?? "",
      phone: row.phone ?? "",
      vehicleNo: row.vehicleNo ?? "",
    });
    setShowForm(false);
    setEditingId(row._id);
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    setEditForm(createDefaultForm());
  }

  function handleOpenDeleteModal(row: VisitorRow) {
    setDeleteTarget({ _id: row._id, visitorName: row.visitorName });
    setError(null);
    setMessage(null);
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

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/sites/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(result.error ?? "방문자 등록 실패");
      }

      setShowForm(false);
      setForm(createDefaultForm());
      setMessage("방문자 정보가 등록되었습니다.");
      fetchData(1);
      setPage(1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "방문자 등록 실패");
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

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/sites/visitors/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(result.error ?? "방문자 수정 실패");
      }

      setEditingId(null);
      setEditForm(createDefaultForm());
      setMessage("방문자 정보가 수정되었습니다.");
      fetchData(page);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "방문자 수정 실패");
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
      const response = await fetch(`/api/sites/visitors/${deleteTarget._id}?siteId=${siteId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(result.error ?? "방문자 삭제 실패");
      }

      setDeleteTarget(null);
      setMessage("방문자 정보가 삭제되었습니다.");
      fetchData(1);
      setPage(1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "방문자 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [...baseColumns, buildActionColumn(handleOpenEditModal, handleOpenDeleteModal)];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">방문자 관리</h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setError(null);
            setMessage(null);
            if (showForm) {
              setForm(createDefaultForm());
            }
          }}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showForm ? (
        <form
          className="space-y-3 rounded-lg border border-border bg-background-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <VisitorFormFields
            form={form}
            memberText={memberSummary(selectedMember, form.contactPerson)}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onOpenMemberModal={() => handleOpenMemberModal("create")}
            onClearMember={() => setForm((prev) => ({ ...prev, contactUserId: "", contactPerson: "" }))}
          />
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

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} emptyMessage="등록된 방문자 기록이 없습니다." />
      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal open={Boolean(editingId)} title="방문자 정보 수정" onClose={handleCloseEditModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUpdate();
          }}
        >
          <VisitorFormFields
            form={editForm}
            memberText={memberSummary(selectedEditMember, editForm.contactPerson)}
            onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
            onOpenMemberModal={() => handleOpenMemberModal("edit")}
            onClearMember={() => setEditForm((prev) => ({ ...prev, contactUserId: "", contactPerson: "" }))}
          />
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

      <Modal open={Boolean(deleteTarget)} title="방문자 정보 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{deleteTarget?.visitorName}</strong> 방문자 기록을 삭제하시겠습니까?
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
              className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={isMemberModalOpen} title="면담자 선택" onClose={handleCloseMemberModal}>
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
                선택 가능한 현장 배치 인력이 없습니다.
              </p>
            ) : null}
            {isMemberLoading ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-foreground-muted">
                현장 배치 인력을 불러오는 중...
              </p>
            ) : null}
          </div>
        </div>
      </Modal>
    </section>
  );
}

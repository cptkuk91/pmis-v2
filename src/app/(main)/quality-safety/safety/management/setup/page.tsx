"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import {
  DEFAULT_GOVERNMENT_REPORT_TYPE,
  GOVERNMENT_REPORT_AGENCIES,
  GOVERNMENT_REPORT_TYPES,
  type GovernmentReportAgency,
  type GovernmentReportType,
} from "@/lib/government-report-constants";

type ReportStatus = "pending" | "submitted" | "completed";
type TabKey = "report" | "assignment";

type ReportRow = {
  _id: string;
  reportType: GovernmentReportType;
  title: string;
  reportDate: string;
  agency: GovernmentReportAgency | "";
  status: ReportStatus;
};

type AssignmentRow = {
  _id: string;
  userId?: string | null;
  sitePersonnelId?: string | null;
  managerName: string;
  position: string;
  certificationNo: string;
  assignedDate: string;
  role: string;
};

type SiteMemberOption = {
  _id: string;
  name: string;
  email: string;
  role: "super_admin" | "site_admin" | "manager" | "viewer";
  membershipRole: "site_admin" | "manager" | "viewer";
};

type ReportFormState = {
  reportType: GovernmentReportType;
  title: string;
  reportDate: string;
  agency: GovernmentReportAgency | "";
  status: ReportStatus;
};

type AssignmentFormState = {
  userId: string;
  managerName: string;
  position: string;
  certificationNo: string;
  assignedDate: string;
  role: string;
};

type DeleteTarget = {
  _id: string;
  recordType: TabKey;
  title: string;
};

const SITE_ID_KEY = "pmis:siteId";
const membershipRoleLabel: Record<SiteMemberOption["membershipRole"], string> = {
  site_admin: "현장관리자",
  manager: "관리자",
  viewer: "열람",
};
const userRoleLabel: Record<SiteMemberOption["role"], string> = {
  super_admin: "최고관리자",
  site_admin: "현장관리자",
  manager: "관리자",
  viewer: "열람",
};
const statusLabel: Record<ReportStatus, string> = {
  pending: "대기",
  submitted: "제출",
  completed: "완료",
};
const reportStatusOptions: Array<{ value: ReportStatus; label: string }> = [
  { value: "pending", label: "대기" },
  { value: "submitted", label: "제출" },
  { value: "completed", label: "완료" },
];

const emptyReportForm = (): ReportFormState => ({
  reportType: DEFAULT_GOVERNMENT_REPORT_TYPE,
  title: "",
  reportDate: "",
  agency: "",
  status: "pending",
});

const emptyAssignmentForm = (): AssignmentFormState => ({
  userId: "",
  managerName: "",
  position: "",
  certificationNo: "",
  assignedDate: "",
  role: "",
});

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

  const byName = options.filter((item) => item.name.trim().toLowerCase() === normalizedName);
  return byName.length === 1 ? byName[0] : null;
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

export default function SafetyManagementSetupPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [tab, setTab] = useState<TabKey>("report");
  const [showForm, setShowForm] = useState(false);
  const [reportForm, setReportForm] = useState<ReportFormState>(emptyReportForm);
  const [assignForm, setAssignForm] = useState<AssignmentFormState>(emptyAssignmentForm);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editReportForm, setEditReportForm] = useState<ReportFormState>(emptyReportForm);
  const [editAssignmentForm, setEditAssignmentForm] = useState<AssignmentFormState>(emptyAssignmentForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [memberOptions, setMemberOptions] = useState<SiteMemberOption[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberModalTarget, setMemberModalTarget] = useState<"create" | "edit" | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedMember = memberOptions.find((item) => item._id === assignForm.userId) ?? null;
  const editSelectedMember = memberOptions.find((item) => item._id === editAssignmentForm.userId) ?? null;
  const filteredMembers = memberOptions.filter((item) => {
    const keyword = memberQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return (
      String(item.name ?? "").toLowerCase().includes(keyword) ||
      String(item.email ?? "").toLowerCase().includes(keyword) ||
      String(item.role ?? "").toLowerCase().includes(keyword) ||
      membershipRoleLabel[item.membershipRole].toLowerCase().includes(keyword)
    );
  });

  const fetchData = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    const response = await fetch(`/api/safety/management/setup?siteId=${siteId}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { reports: ReportRow[]; assignments: AssignmentRow[] };
      error?: string;
    };
    if (!result.ok) {
      throw new Error(result.error ?? "착수 준비 데이터 조회 실패");
    }

    setReports(Array.isArray(result.data?.reports) ? result.data?.reports : []);
    setAssignments(Array.isArray(result.data?.assignments) ? result.data?.assignments : []);
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
        throw new Error(result.error ?? "현장 사용자 조회 실패");
      }
      setMemberOptions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 사용자 조회 실패");
    } finally {
      setIsMemberLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await fetchData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "착수 준비 데이터 조회 실패");
      }
    })();
  }, [fetchData]);

  useEffect(() => {
    if (!showForm || tab !== "assignment") {
      return;
    }
    void loadMembers();
  }, [showForm, tab, loadMembers]);

  useEffect(() => {
    if (!editingAssignmentId) {
      return;
    }
    void loadMembers();
  }, [editingAssignmentId, loadMembers]);

  useEffect(() => {
    if (
      !editingAssignmentId ||
      editAssignmentForm.userId ||
      !editAssignmentForm.managerName ||
      memberOptions.length === 0
    ) {
      return;
    }

    const matched = findUniqueMemberMatch(editAssignmentForm.managerName, memberOptions);
    if (!matched) {
      return;
    }

    setEditAssignmentForm((prev) => {
      if (prev.userId || prev.managerName !== editAssignmentForm.managerName) {
        return prev;
      }
      return {
        ...prev,
        userId: matched._id,
        managerName: matched.name,
      };
    });
  }, [
    editingAssignmentId,
    editAssignmentForm.userId,
    editAssignmentForm.managerName,
    memberOptions,
  ]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const body =
        tab === "report"
          ? { type: "report", ...reportForm, siteId }
          : { type: "assignment", ...assignForm, siteId };
      const response = await fetch("/api/safety/management/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(
          result.error ??
            (tab === "report" ? "인허가 신고 등록 실패" : "안전관리자 선임 등록 실패"),
        );
      }

      setShowForm(false);
      setReportForm(emptyReportForm());
      setAssignForm(emptyAssignmentForm());
      setMessage(tab === "report" ? "인허가 신고가 등록되었습니다." : "안전관리자 선임 정보가 등록되었습니다.");
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tab === "report"
            ? "인허가 신고 등록 실패"
            : "안전관리자 선임 등록 실패",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
      setEditAssignmentForm((prev) => ({
        ...prev,
        userId: item._id,
        managerName: item.name,
      }));
    } else {
      setAssignForm((prev) => ({
        ...prev,
        userId: item._id,
        managerName: item.name,
      }));
    }
    setIsMemberModalOpen(false);
    setMemberModalTarget(null);
    setMemberQuery("");
  }

  function handleEditReport(row: ReportRow) {
    setEditingReportId(row._id);
    setEditReportForm({
      reportType: row.reportType,
      title: row.title ?? "",
      reportDate: row.reportDate?.slice(0, 10) ?? "",
      agency: row.agency ?? "",
      status: row.status ?? "pending",
    });
    setError(null);
    setMessage(null);
  }

  function handleEditAssignment(row: AssignmentRow) {
    setEditingAssignmentId(row._id);
    setEditAssignmentForm({
      userId: row.userId ?? "",
      managerName: row.managerName ?? "",
      position: row.position ?? "",
      certificationNo: row.certificationNo ?? "",
      assignedDate: row.assignedDate?.slice(0, 10) ?? "",
      role: row.role ?? "",
    });
    setError(null);
    setMessage(null);
  }

  function handleCloseReportModal() {
    if (isUpdating) {
      return;
    }
    setEditingReportId(null);
    setEditReportForm(emptyReportForm());
  }

  function handleCloseAssignmentModal() {
    if (isUpdating) {
      return;
    }
    setEditingAssignmentId(null);
    setEditAssignmentForm(emptyAssignmentForm());
    if (memberModalTarget === "edit") {
      setIsMemberModalOpen(false);
      setMemberModalTarget(null);
      setMemberQuery("");
    }
  }

  async function handleUpdateReport() {
    if (!editingReportId) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/safety/management/setup/${editingReportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: "report",
          siteId,
          ...editReportForm,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "인허가 신고 수정 실패");
      }

      handleCloseReportModal();
      setMessage("인허가 신고가 수정되었습니다.");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "인허가 신고 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleUpdateAssignment() {
    if (!editingAssignmentId) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/safety/management/setup/${editingAssignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: "assignment",
          siteId,
          ...editAssignmentForm,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전관리자 선임 수정 실패");
      }

      handleCloseAssignmentModal();
      setMessage("안전관리자 선임 정보가 수정되었습니다.");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전관리자 선임 수정 실패");
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
    setError(null);
    setMessage(null);
    setDeletingId(deleteTarget._id);

    try {
      const params = new URLSearchParams({
        siteId,
        recordType: deleteTarget.recordType,
      });
      const response = await fetch(
        `/api/safety/management/setup/${deleteTarget._id}?${params.toString()}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(
          result.error ??
            (deleteTarget.recordType === "report"
              ? "인허가 신고 삭제 실패"
              : "안전관리자 선임 삭제 실패"),
        );
      }

      if (editingReportId === deleteTarget._id) {
        handleCloseReportModal();
      }
      if (editingAssignmentId === deleteTarget._id) {
        handleCloseAssignmentModal();
      }

      setDeleteTarget(null);
      setMessage(
        deleteTarget.recordType === "report"
          ? "인허가 신고가 삭제되었습니다."
          : "안전관리자 선임 정보가 삭제되었습니다.",
      );
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : deleteTarget.recordType === "report"
            ? "인허가 신고 삭제 실패"
            : "안전관리자 선임 삭제 실패",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const reportColumns: DataTableColumn<ReportRow>[] = [
    { key: "reportType", header: "유형", className: "w-32" },
    { key: "title", header: "제목" },
    { key: "agency", header: "기관", className: "w-32" },
    {
      key: "reportDate",
      header: "신고일",
      className: "w-28",
      render: (_value, row) => row.reportDate?.slice(0, 10),
    },
    {
      key: "status",
      header: "상태",
      className: "w-20",
      render: (_value, row) => statusLabel[row.status] ?? row.status,
    },
    {
      key: "_id",
      header: "관리",
      className: "w-28",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEditReport(row)}
            aria-label="인허가 신고 수정"
            title="수정"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() =>
              handleOpenDeleteModal({
                _id: row._id,
                recordType: "report",
                title: row.title,
              })
            }
            aria-label="인허가 신고 삭제"
            title="삭제"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-danger/40 text-danger hover:bg-danger/10"
          >
            <DeleteIcon />
          </button>
        </div>
      ),
    },
  ];

  const assignColumns: DataTableColumn<AssignmentRow>[] = [
    { key: "managerName", header: "성명" },
    { key: "position", header: "직위" },
    { key: "role", header: "역할" },
    { key: "certificationNo", header: "자격번호" },
    {
      key: "assignedDate",
      header: "선임일",
      className: "w-28",
      render: (_value, row) => row.assignedDate?.slice(0, 10),
    },
    {
      key: "_id",
      header: "관리",
      className: "w-28",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEditAssignment(row)}
            aria-label="안전관리자 선임 수정"
            title="수정"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() =>
              handleOpenDeleteModal({
                _id: row._id,
                recordType: "assignment",
                title: row.managerName,
              })
            }
            aria-label="안전관리자 선임 삭제"
            title="삭제"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-danger/40 text-danger hover:bg-danger/10"
          >
            <DeleteIcon />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">착수 준비 (인허가 신고/관리자 선임)</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        <button
          type="button"
          onClick={() => setTab("report")}
          className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
            tab === "report"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-soft"
          }`}
        >
          인허가 신고
        </button>
        <button
          type="button"
          onClick={() => setTab("assignment")}
          className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
            tab === "assignment"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-soft"
          }`}
        >
          안전관리자 선임
        </button>
      </div>

      {showForm && tab === "report" ? (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">유형 *</span>
              <select
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={reportForm.reportType}
                onChange={(event) =>
                  setReportForm((prev) => ({
                    ...prev,
                    reportType: event.target.value as GovernmentReportType,
                  }))
                }
              >
                {GOVERNMENT_REPORT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">제목 *</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={reportForm.title}
                onChange={(event) =>
                  setReportForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">기관</span>
              <select
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={reportForm.agency}
                onChange={(event) =>
                  setReportForm((prev) => ({
                    ...prev,
                    agency: event.target.value as GovernmentReportAgency | "",
                  }))
                }
              >
                <option value="">기관 선택</option>
                {GOVERNMENT_REPORT_AGENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">신고일 *</span>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={reportForm.reportDate}
                onChange={(event) =>
                  setReportForm((prev) => ({ ...prev, reportDate: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      {showForm && tab === "assignment" ? (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1 md:col-span-3">
              <span className="block text-sm font-medium text-foreground">현장 사용자 *</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={memberSummary(selectedMember, assignForm.managerName)}
                  placeholder="안전관리자로 선임할 현장 사용자를 선택해 주세요."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenMemberModal("create")}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    사용자 선택
                  </button>
                  {assignForm.userId ? (
                    <button
                      type="button"
                      onClick={() => setAssignForm(emptyAssignmentForm())}
                      className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                    >
                      초기화
                    </button>
                  ) : null}
                </div>
              </div>
              {selectedMember ? (
                <p className="text-xs text-foreground-muted">
                  현장 권한 {membershipRoleLabel[selectedMember.membershipRole]}
                  {selectedMember.email ? ` · ${selectedMember.email}` : ""}
                  {selectedMember.role ? ` · 시스템 권한 ${userRoleLabel[selectedMember.role]}` : ""}
                </p>
              ) : null}
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">성명 *</span>
              <input
                readOnly
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={assignForm.managerName}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">직위</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={assignForm.position}
                onChange={(event) =>
                  setAssignForm((prev) => ({ ...prev, position: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">역할</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={assignForm.role}
                onChange={(event) =>
                  setAssignForm((prev) => ({ ...prev, role: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">자격번호</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={assignForm.certificationNo}
                onChange={(event) =>
                  setAssignForm((prev) => ({
                    ...prev,
                    certificationNo: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">선임일 *</span>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={assignForm.assignedDate}
                onChange={(event) =>
                  setAssignForm((prev) => ({ ...prev, assignedDate: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "report" ? (
        <DataTable columns={reportColumns} data={reports} rowKey={(row) => row._id} />
      ) : (
        <DataTable columns={assignColumns} data={assignments} rowKey={(row) => row._id} />
      )}

      <Modal open={Boolean(editingReportId)} title="인허가 신고 수정" onClose={handleCloseReportModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUpdateReport();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">유형 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editReportForm.reportType}
                onChange={(event) =>
                  setEditReportForm((prev) => ({
                    ...prev,
                    reportType: event.target.value as GovernmentReportType,
                  }))
                }
              >
                {GOVERNMENT_REPORT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">기관</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editReportForm.agency}
                onChange={(event) =>
                  setEditReportForm((prev) => ({
                    ...prev,
                    agency: event.target.value as GovernmentReportAgency | "",
                  }))
                }
              >
                <option value="">기관 선택</option>
                {GOVERNMENT_REPORT_AGENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">제목 *</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editReportForm.title}
                onChange={(event) =>
                  setEditReportForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">신고일 *</span>
              <input
                type="date"
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editReportForm.reportDate}
                onChange={(event) =>
                  setEditReportForm((prev) => ({ ...prev, reportDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editReportForm.status}
                onChange={(event) =>
                  setEditReportForm((prev) => ({
                    ...prev,
                    status: event.target.value as ReportStatus,
                  }))
                }
              >
                {reportStatusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseReportModal}
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

      <Modal open={Boolean(editingAssignmentId)} title="안전관리자 선임 수정" onClose={handleCloseAssignmentModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUpdateAssignment();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">현장 사용자 *</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  className="h-10 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={memberSummary(editSelectedMember, editAssignmentForm.managerName)}
                  placeholder="안전관리자로 선임된 현장 사용자를 선택해 주세요."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenMemberModal("edit")}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    사용자 선택
                  </button>
                </div>
              </div>
              {editSelectedMember ? (
                <p className="text-xs text-foreground-muted">
                  현장 권한 {membershipRoleLabel[editSelectedMember.membershipRole]}
                  {editSelectedMember.email ? ` · ${editSelectedMember.email}` : ""}
                  {editSelectedMember.role ? ` · 시스템 권한 ${userRoleLabel[editSelectedMember.role]}` : ""}
                </p>
              ) : null}
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">성명 *</span>
              <input
                readOnly
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editAssignmentForm.managerName}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">직위</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editAssignmentForm.position}
                onChange={(event) =>
                  setEditAssignmentForm((prev) => ({ ...prev, position: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">역할</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editAssignmentForm.role}
                onChange={(event) =>
                  setEditAssignmentForm((prev) => ({ ...prev, role: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">자격번호</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editAssignmentForm.certificationNo}
                onChange={(event) =>
                  setEditAssignmentForm((prev) => ({
                    ...prev,
                    certificationNo: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">선임일 *</span>
              <input
                type="date"
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editAssignmentForm.assignedDate}
                onChange={(event) =>
                  setEditAssignmentForm((prev) => ({
                    ...prev,
                    assignedDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseAssignmentModal}
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

      <Modal open={isMemberModalOpen} title="현장 사용자 선택" onClose={handleCloseMemberModal}>
        <div className="space-y-4">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">검색</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="성명, 이메일, 권한으로 검색"
            />
          </label>

          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((item) => {
                const currentUserId = memberModalTarget === "edit" ? editAssignmentForm.userId : assignForm.userId;
                const isSelected = currentUserId === item._id;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => handleSelectMember(item)}
                    className={`flex w-full items-start justify-between rounded-md border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-border-strong bg-background-card"
                        : "border-transparent hover:border-border hover:bg-background-card"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">{item.name}</span>
                      <span className="block text-xs text-foreground-muted">{item.email || "-"}</span>
                    </span>
                    <span className="text-right text-xs text-foreground-muted">
                      <span className="block">현장 {membershipRoleLabel[item.membershipRole]}</span>
                      <span className="block">시스템 {userRoleLabel[item.role]}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-6 text-center text-sm text-foreground-muted">
                {isMemberLoading ? "현장 사용자 목록을 불러오는 중..." : "조회된 현장 사용자가 없습니다."}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCloseMemberModal}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              닫기
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.recordType === "report" ? "인허가 신고 삭제" : "안전관리자 선임 삭제"}
        onClose={handleCloseDeleteModal}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{deleteTarget?.title}</strong>
            {deleteTarget?.recordType === "report"
              ? " 신고 항목을 삭제하시겠습니까?"
              : " 선임 정보를 삭제하시겠습니까?"}
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

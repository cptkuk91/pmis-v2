"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";

type CheckType = "regular" | "special" | "hiring";
type CheckResult = "normal" | "observation" | "abnormal";

type HealthRow = {
  _id: string;
  workerUserId?: string | null;
  workerName: string;
  company: string;
  checkType: CheckType;
  checkDate: string;
  result: CheckResult;
  hospital: string;
};

type SiteMemberOption = {
  _id: string;
  name: string;
  email: string;
  role: "super_admin" | "site_admin" | "manager" | "viewer";
  membershipRole: "site_admin" | "manager" | "viewer";
};

type HealthFormState = {
  workerUserId: string;
  workerName: string;
  company: string;
  checkType: CheckType;
  checkDate: string;
  result: CheckResult;
  hospital: string;
};

const SITE_ID_KEY = "pmis:siteId";
const checkTypeLabel: Record<CheckType, string> = {
  regular: "정기",
  special: "특수",
  hiring: "채용",
};
const resultLabel: Record<CheckResult, string> = {
  normal: "정상",
  observation: "관찰",
  abnormal: "이상",
};
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
const columns: DataTableColumn<HealthRow>[] = [
  { key: "workerName", header: "성명" },
  { key: "company", header: "소속" },
  {
    key: "checkType",
    header: "구분",
    className: "w-20",
    render: (_value, row) => checkTypeLabel[row.checkType] ?? row.checkType,
  },
  {
    key: "checkDate",
    header: "검진일",
    className: "w-28",
    render: (_value, row) => row.checkDate?.slice(0, 10),
  },
  {
    key: "result",
    header: "결과",
    className: "w-20",
    render: (_value, row) => resultLabel[row.result] ?? row.result,
  },
  { key: "hospital", header: "병원" },
];

const emptyForm = (): HealthFormState => ({
  workerUserId: "",
  workerName: "",
  company: "",
  checkType: "regular",
  checkDate: "",
  result: "normal",
  hospital: "",
});

function memberSummary(item: SiteMemberOption | null, fallbackName = ""): string {
  if (item) {
    return item.email ? `${item.name} · ${item.email}` : item.name;
  }
  return fallbackName;
}

export default function SafetyHealthPage() {
  const [data, setData] = useState<HealthRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<HealthFormState>(emptyForm);
  const [memberOptions, setMemberOptions] = useState<SiteMemberOption[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedMember = memberOptions.find((item) => item._id === form.workerUserId) ?? null;
  const filteredMembers = memberOptions.filter((item) => {
    const keyword = memberQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.email.toLowerCase().includes(keyword) ||
      membershipRoleLabel[item.membershipRole].toLowerCase().includes(keyword) ||
      userRoleLabel[item.role].toLowerCase().includes(keyword)
    );
  });

  const fetchData = useCallback((nextPage: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }
    fetch(`/api/safety/health?siteId=${siteId}&page=${nextPage}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) {
          setData(Array.isArray(result.data) ? result.data : []);
          setTotalPages(result.meta?.totalPages ?? 1);
        }
      })
      .catch(() => {
        setError("건강검진 내역 조회 실패");
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
    setError(null);
    fetchData(page);
  }, [page, fetchData]);

  useEffect(() => {
    if (!showForm) {
      return;
    }
    void loadMembers();
  }, [showForm, loadMembers]);

  function handleOpenMemberModal() {
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
    setMemberQuery("");
  }

  function handleSelectMember(member: SiteMemberOption) {
    setForm((prev) => ({
      ...prev,
      workerUserId: member._id,
      workerName: member.name,
    }));
    setIsMemberModalOpen(false);
    setMemberQuery("");
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);

    if (!form.workerUserId) {
      setError("검진 대상자를 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/safety/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "건강검진 등록 실패");
      }

      setShowForm(false);
      setForm(emptyForm());
      setMessage("건강검진 내역이 등록되었습니다.");
      fetchData(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "건강검진 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">건강검진</h1>
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

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <form
          className="space-y-3 rounded-lg border border-border bg-background-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1 md:col-span-3">
              <span className="block text-sm font-medium text-foreground">검진 대상자 *</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={memberSummary(selectedMember, form.workerName)}
                  placeholder="현장 배치 사용자 중 검진 대상자를 선택해 주세요."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOpenMemberModal}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    사용자 선택
                  </button>
                  {form.workerUserId ? (
                    <button
                      type="button"
                      onClick={() => setForm(emptyForm())}
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
                value={form.workerName}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">소속</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.company}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">구분 *</span>
              <select
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.checkType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, checkType: event.target.value as CheckType }))
                }
              >
                <option value="regular">정기</option>
                <option value="special">특수</option>
                <option value="hiring">채용</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">검진일</span>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.checkDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, checkDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">결과 *</span>
              <select
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.result}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, result: event.target.value as CheckResult }))
                }
              >
                <option value="normal">정상</option>
                <option value="observation">관찰</option>
                <option value="abnormal">이상</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">병원</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.hospital}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, hospital: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      ) : null}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

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
              filteredMembers.map((member) => {
                const isSelected = form.workerUserId === member._id;
                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => handleSelectMember(member)}
                    className={`flex w-full items-start justify-between rounded-md border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-border-strong bg-background-card"
                        : "border-transparent hover:border-border hover:bg-background-card"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">{member.name}</span>
                      <span className="block text-xs text-foreground-muted">{member.email || "-"}</span>
                    </span>
                    <span className="text-right text-xs text-foreground-muted">
                      <span className="block">현장 {membershipRoleLabel[member.membershipRole]}</span>
                      <span className="block">시스템 {userRoleLabel[member.role]}</span>
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
    </section>
  );
}

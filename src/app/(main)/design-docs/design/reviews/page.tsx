"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Modal, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  findUniqueSiteMemberMatch,
  formatSiteMemberSummary,
  useSiteMembers,
} from "@/hooks/use-site-members";
import {
  DEFAULT_DRAWING_DISCIPLINE,
  DRAWING_DISCIPLINES,
  normalizeDrawingDiscipline,
  type DrawingDiscipline,
} from "@/lib/drawing-discipline";

type ReviewItem = {
  _id: string;
  docNo: string;
  drawingNo: string;
  drawingName: string;
  requesterName: string;
  reviewerName: string;
  requestedAt: string;
  decisionStatus: "pending" | "approved" | "rejected";
};

type ReviewResponse = {
  ok: boolean;
  data: ReviewItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

function decisionToBadge(status: ReviewItem["decisionStatus"]) {
  if (status === "approved") {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return "in_review";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR");
}

export default function DrawingReviewsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);
  const canDecide = useMemo(() => hasMinRole(user.role, "site_admin"), [user.role]);

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [sort, setSort] = useState<"latest" | "oldest" | "doc_asc" | "doc_desc">("latest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [previewDocNo, setPreviewDocNo] = useState("");
  const [drawingNo, setDrawingNo] = useState("");
  const [drawingName, setDrawingName] = useState("");
  const [discipline, setDiscipline] = useState<DrawingDiscipline>(DEFAULT_DRAWING_DISCIPLINE);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerMemberId, setReviewerMemberId] = useState("");
  const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDocNo, setIsLoadingDocNo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    memberOptions,
    filteredMembers,
    memberQuery,
    setMemberQuery,
    isMemberLoading,
    memberError,
  } = useSiteMembers(canWrite);

  const selectedReviewer =
    memberOptions.find((item) => item._id === reviewerMemberId) ??
    findUniqueSiteMemberMatch(reviewerName, memberOptions);

  const loadReviews = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          status: statusFilter,
          sort,
        });
        const response = await fetch(`/api/drawing-reviews?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ReviewResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "도면검토현황 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "도면검토현황 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, sort, statusFilter],
  );

  useEffect(() => {
    void loadReviews(1);
  }, [loadReviews]);

  const loadPreviewDocNo = useCallback(async () => {
    if (!canWrite) {
      setPreviewDocNo("");
      return;
    }

    setIsLoadingDocNo(true);
    try {
      const response = await fetch("/api/documents/next-doc-no", { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { docNo?: string };
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "문서번호 조회 실패");
      }
      setPreviewDocNo(result.data?.docNo ?? "");
    } catch {
      setPreviewDocNo("");
    } finally {
      setIsLoadingDocNo(false);
    }
  }, [canWrite]);

  useEffect(() => {
    void loadPreviewDocNo();
  }, [loadPreviewDocNo]);

  async function handleQuickCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/drawing-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawingNo,
          drawingName,
          discipline,
          reviewerName,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "검토요청 등록 실패");
      }
      setDrawingNo("");
      setDrawingName("");
      setDiscipline(DEFAULT_DRAWING_DISCIPLINE);
      setReviewerName("");
      setReviewerMemberId("");
      setMessage("검토요청이 등록되었습니다.");
      await loadPreviewDocNo();
      await loadReviews(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검토요청 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenReviewerModal() {
    setMemberQuery("");
    setIsReviewerModalOpen(true);
  }

  function handleCloseReviewerModal() {
    setIsReviewerModalOpen(false);
  }

  function handleSelectReviewer(memberId: string, name: string) {
    setReviewerMemberId(memberId);
    setReviewerName(name);
    setMemberQuery("");
    setIsReviewerModalOpen(false);
  }

  function handleResetReviewer() {
    setReviewerMemberId("");
    setReviewerName("");
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">도면검토현황</h1>
          <p className="mt-1 text-sm text-foreground-muted">검토요청/결과통보/승인 상태를 관리합니다.</p>
        </div>
        <Link
          href="/design-docs/design/reviews/new/request"
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          상세 요청작성
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="문서번호/도면번호/도면명/요청자/검토자"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "pending" | "approved" | "rejected")}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="pending">검토중</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">정렬</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "latest" | "oldest" | "doc_asc" | "doc_desc")}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="doc_asc">문서번호 오름차순</option>
            <option value="doc_desc">문서번호 내림차순</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadReviews(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canWrite ? (
        <form onSubmit={handleQuickCreate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[180px_180px_minmax(260px,1fr)_140px]">
            <FormInput
              label="문서번호"
              value={previewDocNo || (isLoadingDocNo ? "자동 채번 중..." : "자동 생성 예정")}
              readOnly
              disabled
            />
            <FormInput label="도면번호" value={drawingNo} onChange={(event) => setDrawingNo(event.target.value)} required />
            <FormInput label="도면명" value={drawingName} onChange={(event) => setDrawingName(event.target.value)} required />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">기술구분</span>
              <select
                value={discipline}
                onChange={(event) => setDiscipline(normalizeDrawingDiscipline(event.target.value))}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {DRAWING_DISCIPLINES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="space-y-1 xl:flex-1">
              <label className="block text-sm font-medium text-foreground">검토자</label>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={formatSiteMemberSummary(selectedReviewer, reviewerName)}
                  placeholder="현장 배치 사용자 중 검토자를 선택해 주세요."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOpenReviewerModal}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    사용자 선택
                  </button>
                  {reviewerName ? (
                    <button
                      type="button"
                      onClick={handleResetReviewer}
                      className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                    >
                      초기화
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="shrink-0 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              간편 등록
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">검토요청 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<ReviewItem>
        columns={[
          {
            key: "docNo",
            header: "검토 대상",
            className: "w-[28rem]",
            render: (_, row) => (
              <div className="space-y-1.5">
                <p className="text-xs leading-5 text-foreground-muted">
                  <span className="mr-2 font-medium">문서번호</span>
                  <span className="break-all text-foreground">{row.docNo}</span>
                </p>
                <p className="text-xs leading-5 text-foreground-muted">
                  <span className="mr-2 font-medium">도면번호</span>
                  <span className="break-all text-foreground">{row.drawingNo}</span>
                </p>
                <p className="line-clamp-2 break-words text-sm font-medium leading-5 text-foreground">
                  {row.drawingName || "-"}
                </p>
              </div>
            ),
          },
          {
            key: "requesterName",
            header: "요청 / 검토",
            className: "w-44",
            render: (_, row) => (
              <div className="space-y-1 text-sm">
                <p className="leading-5 text-foreground">
                  <span className="text-xs font-medium text-foreground-muted">요청</span>{" "}
                  <span className="font-medium">{row.requesterName}</span>
                </p>
                <p className="leading-5 text-foreground">
                  <span className="text-xs font-medium text-foreground-muted">검토</span>{" "}
                  <span className="font-medium">{row.reviewerName}</span>
                </p>
              </div>
            ),
          },
          {
            key: "decisionStatus",
            header: "상태 / 요청일",
            className: "w-36",
            render: (value, row) => (
              <div className="space-y-1">
                <div>
                  <StatusBadge status={decisionToBadge(value as ReviewItem["decisionStatus"])} />
                </div>
                <p className="text-xs text-foreground-muted">{formatDate(row.requestedAt)}</p>
              </div>
            ),
          },
          {
            key: "_id",
            header: "작업",
            className: "w-44",
            render: (_, row) => (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/design-docs/design/reviews/${row._id}/request`}
                  className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                >
                  요청서
                </Link>
                {canDecide ? (
                  <Link
                    href={`/design-docs/design/reviews/${row._id}/result`}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    결과통보
                  </Link>
                ) : null}
              </div>
            ),
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 검토요청이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadReviews(nextPage)} />

      <Modal open={isReviewerModalOpen} title="검토자 선택" onClose={handleCloseReviewerModal}>
        <div className="space-y-4">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">검색</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="이름, 이메일, 권한으로 검색"
            />
          </label>
          {memberError ? <p className="text-sm text-danger">{memberError}</p> : null}
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isSelected = selectedReviewer?._id === member._id;
                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => handleSelectReviewer(member._id, member.name)}
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
                      <span className="block">현장 {member.membershipRole}</span>
                      <span className="block">시스템 {member.role}</span>
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
              onClick={handleCloseReviewerModal}
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

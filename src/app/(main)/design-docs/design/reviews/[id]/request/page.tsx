"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FormInput, Modal } from "@/components/ui";
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

type ReviewDetail = {
  _id: string;
  docNo: string;
  drawingNo: string;
  drawingName: string;
  discipline: string;
  location: string;
  reviewerName: string;
  requestContent: string;
  classificationCode: string;
};

export default function DrawingReviewRequestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const reviewId = String(params.id ?? "new");

  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [docNo, setDocNo] = useState("");
  const [drawingNo, setDrawingNo] = useState("");
  const [drawingName, setDrawingName] = useState("");
  const [discipline, setDiscipline] = useState<DrawingDiscipline>(DEFAULT_DRAWING_DISCIPLINE);
  const [location, setLocation] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerMemberId, setReviewerMemberId] = useState("");
  const [requestContent, setRequestContent] = useState("");
  const [classificationCode, setClassificationCode] = useState("");

  const [isLoading, setIsLoading] = useState(reviewId !== "new");
  const [isLoadingDocNo, setIsLoadingDocNo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);
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

  const loadPreviewDocNo = useCallback(async () => {
    if (!canWrite || reviewId !== "new") {
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
      setDocNo(result.data?.docNo ?? "");
    } catch {
      setDocNo("");
    } finally {
      setIsLoadingDocNo(false);
    }
  }, [canWrite, reviewId]);

  useEffect(() => {
    void loadPreviewDocNo();
  }, [loadPreviewDocNo]);

  useEffect(() => {
    if (reviewId === "new") {
      return;
    }

    const loadDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/drawing-reviews/${reviewId}`, { cache: "no-store" });
        const result = (await response.json()) as { ok: boolean; data?: ReviewDetail; error?: string };
        if (!result.ok || !result.data) {
          throw new Error(result.error ?? "검토요청 조회 실패");
        }
        setDocNo(result.data.docNo);
        setDrawingNo(result.data.drawingNo);
        setDrawingName(result.data.drawingName);
        setDiscipline(normalizeDrawingDiscipline(result.data.discipline));
        setLocation(result.data.location ?? "");
        setReviewerName(result.data.reviewerName ?? "");
        setReviewerMemberId("");
        setRequestContent(result.data.requestContent ?? "");
        setClassificationCode(result.data.classificationCode ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "검토요청 조회 실패");
      } finally {
        setIsLoading(false);
      }
    };

    void loadDetail();
  }, [reviewId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const endpoint = reviewId === "new" ? "/api/drawing-reviews" : `/api/drawing-reviews/${reviewId}`;
      const method = reviewId === "new" ? "POST" : "PATCH";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawingNo,
          drawingName,
          discipline,
          location,
          reviewerName,
          requestContent,
          classificationCode,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "검토요청 저장 실패");
      }

      setMessage("검토요청이 저장되었습니다.");
      router.push("/design-docs/design/reviews");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "검토요청 저장 실패");
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

  async function handleDelete() {
    if (!canWrite || reviewId === "new" || !confirm("검토요청을 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/drawing-reviews/${reviewId}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "검토요청 삭제 실패");
      }
      router.push("/design-docs/design/reviews");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "검토요청 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          검토요청 작성 {reviewId === "new" ? "(신규)" : "(수정)"}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">도면 검토요청 상세 입력 화면</p>
      </header>

      {canWrite ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormInput
              label="문서번호"
              value={docNo || (isLoadingDocNo ? "자동 채번 중..." : "자동 생성 예정")}
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
            <FormInput label="위치" value={location} onChange={(event) => setLocation(event.target.value)} />
            <FormInput label="분류코드" value={classificationCode} onChange={(event) => setClassificationCode(event.target.value)} />
            <div className="space-y-1 md:col-span-2">
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
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">요청내용</span>
            <textarea
              value={requestContent}
              onChange={(event) => setRequestContent(event.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              저장
            </button>
            {reviewId !== "new" ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-md border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => router.push("/design-docs/design/reviews")}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              목록
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">검토요청 작성은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

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

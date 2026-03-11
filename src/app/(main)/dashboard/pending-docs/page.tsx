"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, Modal } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type PendingDocItem = {
  _id: string;
  docNo: string;
  title: string;
  status: "in_review";
  draftByName: string;
  submittedAt: string | null;
  updatedAt: string | null;
  currentApprovalOrder: number;
  totalApprovalSteps: number;
  currentApproverName: string;
  currentApproverRoleTitle: string;
  finalApproverName: string;
};

type DocumentAttachment = {
  _id: string;
  fileAssetId: string;
  fileName: string;
  sortOrder: number;
  originalName: string;
  storagePath: string;
  url: string;
};

type DocumentApprovalLine = {
  _id: string;
  order: number;
  approverName: string;
  approverRoleTitle: string;
  status: "pending" | "approved" | "rejected";
  actedAt: string | null;
  comment: string;
};

type PendingDocumentDetail = {
  document: {
    _id: string;
    docNo: string;
    title: string;
    content: string;
    draftByName: string;
    senderName: string;
    receiverName: string;
    status: "draft" | "in_review" | "approved" | "rejected" | "completed";
    submittedAt?: string | null;
    updatedAt?: string | null;
  };
  attachments: DocumentAttachment[];
  approvalLines: DocumentApprovalLine[];
  approvalSummary: {
    totalSteps: number;
    approvedSteps: number;
    rejectedSteps: number;
    pendingSteps: number;
    currentApprovalOrder: number;
    currentApproverName: string;
    currentApproverRoleTitle: string;
  };
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("ko-KR");
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PendingStatusBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      결재 대기
    </span>
  );
}

function ApprovalLineBadge({ status }: { status: DocumentApprovalLine["status"] }) {
  const toneClass =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  const label = status === "approved" ? "승인" : status === "rejected" ? "반려" : "대기";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
  );
}

export default function DashboardPendingDocsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManageDecision = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<PendingDocItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PendingDocumentDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [decisionMode, setDecisionMode] = useState<"approved" | "rejected" | null>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const summary = useMemo(() => {
    const total = items.length;
    const firstSubmitted = items
      .map((item) => item.submittedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
    const approverSet = new Set(items.map((item) => item.currentApproverName).filter(Boolean));

    return {
      total,
      approverCount: approverSet.size,
      latestSubmittedAt: firstSubmitted ?? null,
    };
  }, [items]);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/documents/pending?limit=50", { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: PendingDocItem[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "미결문서 조회 실패");
      }

      setItems(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "미결문서 조회 실패");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (documentId: string) => {
    setIsDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}`, { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: PendingDocumentDetail;
        error?: string;
      };
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "문서 상세 조회 실패");
      }

      setDetail(result.data);
    } catch (err) {
      setDetail(null);
      setDetailError(err instanceof Error ? err.message : "문서 상세 조회 실패");
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isUserLoading) {
      return;
    }
    if (!canManageDecision) {
      setItems([]);
      setError(null);
      return;
    }

    void loadItems();
  }, [canManageDecision, isUserLoading, loadItems]);

  function closeDetailModal() {
    setSelectedDocumentId(null);
    setDetail(null);
    setDetailError(null);
    setDecisionMode(null);
    setDecisionComment("");
    setDecisionError(null);
  }

  function openDecisionPanel(nextMode: "approved" | "rejected") {
    setDecisionMode(nextMode);
    setDecisionComment("");
    setDecisionError(null);
  }

  async function openDetail(documentId: string) {
    setSelectedDocumentId(documentId);
    setDecisionMode(null);
    setDecisionComment("");
    setDecisionError(null);
    void loadDetail(documentId);
  }

  async function submitDecision(decision: "approved" | "rejected") {
    if (!selectedDocumentId) {
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/documents/${selectedDocumentId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comment: decision === "rejected" ? decisionComment : "",
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { status?: string };
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "결재 처리 실패");
      }

      await loadItems();

      if (result.data?.status === "in_review") {
        setMessage("승인 처리되었습니다. 다음 결재선으로 이동했습니다.");
        setDecisionMode(null);
        setDecisionComment("");
        await loadDetail(selectedDocumentId);
      } else {
        setMessage(decision === "approved" ? "문서가 최종 승인되었습니다." : "문서가 반려되었습니다.");
        closeDetailModal();
      }
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "결재 처리 실패");
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  if (!isUserLoading && !canManageDecision) {
    return (
      <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
        <header>
          <h1 className="text-xl font-semibold text-foreground">미결문서</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            결재 대기 문서는 `manager` 이상 권한에서 확인할 수 있습니다.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">미결문서</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              실제 결재 진행 중(`in_review`) 문서만 표시합니다. 임시저장 문서는 문서 원장에서 관리합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/design-docs/documents/search"
              className="inline-flex rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
            >
              문서 원장
            </Link>
            <Link
              href="/design-docs/documents/wizard/1"
              className="inline-flex rounded-md border border-border bg-background-card px-3 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              문서 작성
            </Link>
            <button
              type="button"
              onClick={() => void loadItems()}
              className="inline-flex rounded-md border border-border bg-background-card px-3 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              새로고침
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-border bg-background-soft px-4 py-3">
            <p className="text-xs font-medium text-foreground-muted">결재 대기 문서</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{summary.total}건</p>
          </article>
          <article className="rounded-xl border border-border bg-background-soft px-4 py-3">
            <p className="text-xs font-medium text-foreground-muted">현재 결재자 수</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{summary.approverCount}명</p>
          </article>
          <article className="rounded-xl border border-border bg-background-soft px-4 py-3">
            <p className="text-xs font-medium text-foreground-muted">최근 상신일</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {formatDate(summary.latestSubmittedAt)}
            </p>
          </article>
        </div>
      </header>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <DataTable<PendingDocItem>
        columns={[
          { key: "docNo", header: "문서번호", className: "w-40" },
          { key: "title", header: "제목" },
          { key: "draftByName", header: "기안자", className: "w-28" },
          {
            key: "currentApproverName",
            header: "현재 결재자",
            className: "w-40",
            render: (value, row) => {
              const roleLabel = row.currentApproverRoleTitle?.trim();
              return (
                <div>
                  <p className="font-medium text-foreground">{String(value || "-")}</p>
                  <p className="text-xs text-foreground-muted">{roleLabel || "직위 미지정"}</p>
                </div>
              );
            },
          },
          {
            key: "currentApprovalOrder",
            header: "결재 단계",
            className: "w-28",
            render: (value, row) => `${value}/${row.totalApprovalSteps || 0}`,
          },
          {
            key: "submittedAt",
            header: "상신일",
            className: "w-32",
            render: (value) => formatDate(String(value ?? "")),
          },
          {
            key: "status",
            header: "상태",
            className: "w-28",
            render: () => <PendingStatusBadge />,
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        onRowClick={(row) => void openDetail(row._id)}
        getRowAriaLabel={(row) => `${row.docNo} ${row.title} 상세 보기`}
        emptyMessage={isLoading ? "불러오는 중..." : "결재 대기 문서가 없습니다."}
      />

      <Modal
        open={Boolean(selectedDocumentId)}
        title={detail?.document.title || "문서 상세"}
        onClose={closeDetailModal}
      >
        <div className="space-y-4">
          {isDetailLoading ? (
            <p className="text-sm text-foreground-muted">문서 상세를 불러오는 중입니다.</p>
          ) : null}

          {detailError ? <p className="text-sm text-danger">{detailError}</p> : null}

          {detail ? (
            <>
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-background-soft p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-foreground-muted">문서번호</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{detail.document.docNo}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">문서 상태</p>
                  <div className="mt-1">
                    <PendingStatusBadge />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">기안자</p>
                  <p className="mt-1 text-sm text-foreground">{detail.document.draftByName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">현재 결재자</p>
                  <p className="mt-1 text-sm text-foreground">
                    {detail.approvalSummary.currentApproverName || "-"}
                    {detail.approvalSummary.currentApproverRoleTitle
                      ? ` / ${detail.approvalSummary.currentApproverRoleTitle}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">상신일</p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDateTime(detail.document.submittedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">최종 수정일</p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDateTime(detail.document.updatedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">발신</p>
                  <p className="mt-1 text-sm text-foreground">{detail.document.senderName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">수신</p>
                  <p className="mt-1 text-sm text-foreground">{detail.document.receiverName || "-"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">문서 내용</h3>
                    <p className="mt-1 text-xs text-foreground-muted">
                      결재 판단 전에 본문과 첨부를 함께 확인하세요.
                    </p>
                  </div>
                  <div className="rounded-full border border-border bg-background-soft px-3 py-1 text-xs font-medium text-foreground-muted">
                    {detail.approvalSummary.currentApprovalOrder}/{detail.approvalSummary.totalSteps} 단계
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-border bg-background-soft px-3 py-3 text-sm leading-6 text-foreground">
                  <p className="whitespace-pre-wrap">{detail.document.content || "문서 내용이 없습니다."}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">결재선</h3>
                <div className="mt-3 space-y-2">
                  {detail.approvalLines.length > 0 ? (
                    detail.approvalLines.map((line) => (
                      <div
                        key={line._id}
                        className="rounded-lg border border-border bg-background-soft px-3 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {line.order}차 결재 · {line.approverName}
                            </p>
                            <p className="mt-1 text-xs text-foreground-muted">
                              {line.approverRoleTitle || "직위 미지정"}
                            </p>
                          </div>
                          <ApprovalLineBadge status={line.status} />
                        </div>
                        <div className="mt-2 text-xs text-foreground-muted">
                          처리일 {formatDateTime(line.actedAt)}
                        </div>
                        {line.comment ? (
                          <p className="mt-2 rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground">
                            {line.comment}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-foreground-muted">설정된 결재선이 없습니다.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">첨부 파일</h3>
                {detail.attachments.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {detail.attachments.map((file) => (
                      <li
                        key={file._id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-background-soft px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {file.originalName || file.fileName}
                          </p>
                          <p className="mt-1 truncate text-xs text-foreground-muted">
                            {file.storagePath || "경로 정보 없음"}
                          </p>
                        </div>
                        {file.url ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-md border border-border bg-background-card px-3 py-2 text-xs font-medium text-foreground hover:bg-background-soft"
                          >
                            파일 열기
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-foreground-muted">첨부 파일이 없습니다.</p>
                )}
              </div>

              {detail.document.status === "in_review" ? (
                <>
                  {decisionError ? <p className="text-sm text-danger">{decisionError}</p> : null}

                  {decisionMode === "approved" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <p className="text-sm font-semibold text-amber-800">이 문서를 승인 처리하시겠습니까?</p>
                      <p className="mt-1 text-xs text-amber-700">
                        다음 결재선이 있으면 자동으로 다음 단계로 이동합니다.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDecisionMode(null)}
                          className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                          disabled={isSubmittingDecision}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitDecision("approved")}
                          className="rounded-md border border-emerald-200 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          disabled={isSubmittingDecision}
                        >
                          {isSubmittingDecision ? "처리 중..." : "승인"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {decisionMode === "rejected" ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
                      <label className="block text-sm font-semibold text-rose-800" htmlFor="decision-comment">
                        반려 사유
                      </label>
                      <textarea
                        id="decision-comment"
                        value={decisionComment}
                        onChange={(event) => setDecisionComment(event.target.value)}
                        rows={4}
                        placeholder="반려 사유를 입력하세요."
                        className="mt-2 w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-foreground outline-none ring-0 placeholder:text-foreground-muted focus:border-rose-300"
                        disabled={isSubmittingDecision}
                      />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDecisionMode(null);
                            setDecisionComment("");
                          }}
                          className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                          disabled={isSubmittingDecision}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitDecision("rejected")}
                          className="rounded-md border border-rose-200 bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                          disabled={isSubmittingDecision}
                        >
                          {isSubmittingDecision ? "처리 중..." : "반려"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {decisionMode === null ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDecisionPanel("rejected")}
                        className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        disabled={isSubmittingDecision}
                      >
                        반려
                      </button>
                      <button
                        type="button"
                        onClick={() => openDecisionPanel("approved")}
                        className="rounded-md border border-emerald-200 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        disabled={isSubmittingDecision}
                      >
                        승인
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="rounded-xl border border-border bg-background-soft px-4 py-3 text-sm text-foreground-muted">
                  현재 문서 상태에서는 결재 처리 버튼을 사용할 수 없습니다.
                </p>
              )}
            </>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}

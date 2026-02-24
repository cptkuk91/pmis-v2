"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FormInput } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ReviewDetail = {
  _id: string;
  docNo: string;
  drawingNo: string;
  drawingName: string;
  requesterName: string;
  reviewerName: string;
  decisionStatus: "pending" | "approved" | "rejected";
  decisionComment: string;
  requestedAt: string;
};

export default function DrawingReviewResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const reviewId = String(params.id ?? "");

  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canDecide = useMemo(() => hasMinRole(user.role, "site_admin"), [user.role]);

  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<"approved" | "rejected">("approved");
  const [reviewerName, setReviewerName] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/drawing-reviews/${reviewId}`, { cache: "no-store" });
        const result = (await response.json()) as { ok: boolean; data?: ReviewDetail; error?: string };
        if (!result.ok || !result.data) {
          throw new Error(result.error ?? "검토요청 조회 실패");
        }
        setDetail(result.data);
        if (result.data.decisionStatus === "approved" || result.data.decisionStatus === "rejected") {
          setDecisionStatus(result.data.decisionStatus);
        }
        setReviewerName(result.data.reviewerName ?? "");
        setDecisionComment(result.data.decisionComment ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "검토요청 조회 실패");
      } finally {
        setIsLoading(false);
      }
    };

    if (reviewId) {
      void loadDetail();
    }
  }, [reviewId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canDecide) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/drawing-reviews/${reviewId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionStatus, decisionComment, reviewerName }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "결과통보 저장 실패");
      }
      setMessage("결과통보가 저장되었습니다.");
      router.push("/design-docs/design/reviews");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "결과통보 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">결과통보 / 승인</h1>
        <p className="mt-1 text-sm text-foreground-muted">site_admin 권한으로 승인/반려를 결정합니다.</p>
      </header>

      {isLoading ? <p className="text-sm text-foreground-muted">불러오는 중...</p> : null}

      {detail ? (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background-soft p-4 md:grid-cols-2">
          <FormInput label="문서번호" value={detail.docNo} readOnly />
          <FormInput label="도면번호" value={detail.drawingNo} readOnly />
          <FormInput label="도면명" value={detail.drawingName} readOnly />
          <FormInput label="요청자" value={detail.requesterName} readOnly />
          <FormInput label="요청일" value={new Date(detail.requestedAt).toLocaleDateString("ko-KR")} readOnly />
        </div>
      ) : null}

      {canDecide ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">검토결과</span>
              <select
                value={decisionStatus}
                onChange={(event) => setDecisionStatus(event.target.value as "approved" | "rejected")}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="approved">승인</option>
                <option value="rejected">반려</option>
              </select>
            </label>
            <FormInput label="검토자" value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} />
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">검토의견</span>
            <textarea
              value={decisionComment}
              onChange={(event) => setDecisionComment(event.target.value)}
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
              결과통보 저장
            </button>
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
        <p className="text-sm text-foreground-muted">결과통보는 `site_admin` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}

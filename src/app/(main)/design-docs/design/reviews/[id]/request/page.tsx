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
  const [discipline, setDiscipline] = useState("건축");
  const [location, setLocation] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [requestContent, setRequestContent] = useState("");
  const [classificationCode, setClassificationCode] = useState("");

  const [isLoading, setIsLoading] = useState(reviewId !== "new");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        setDiscipline(result.data.discipline ?? "건축");
        setLocation(result.data.location ?? "");
        setReviewerName(result.data.reviewerName ?? "");
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
          docNo,
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
            <FormInput label="문서번호" value={docNo} onChange={(event) => setDocNo(event.target.value)} required />
            <FormInput label="도면번호" value={drawingNo} onChange={(event) => setDrawingNo(event.target.value)} required />
            <FormInput label="도면명" value={drawingName} onChange={(event) => setDrawingName(event.target.value)} required />
            <FormInput label="기술구분" value={discipline} onChange={(event) => setDiscipline(event.target.value)} />
            <FormInput label="위치" value={location} onChange={(event) => setLocation(event.target.value)} />
            <FormInput label="분류코드" value={classificationCode} onChange={(event) => setClassificationCode(event.target.value)} />
            <FormInput label="검토자" value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} />
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
    </section>
  );
}

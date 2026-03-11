"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileUpload, FormInput } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type WizardAttachment = {
  fileAssetId: string;
  fileName: string;
};

type WizardApprovalLine = {
  order: number;
  approverName: string;
  approverRoleTitle: string;
};

type WizardState = {
  docNo: string;
  title: string;
  content: string;
  ledgerType: "instruction" | "outbound" | "inbound" | "general";
  direction: "outbound" | "inbound" | "internal";
  categoryCode: string;
  senderName: string;
  receiverName: string;
  attachments: WizardAttachment[];
  approvalLines: WizardApprovalLine[];
};

type UploadResponse = {
  ok: boolean;
  data?: {
    fileAssetId: string;
    originalName: string;
  };
  error?: string;
};

type SaveState = "idle" | "saving" | "saved";

type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

const STORAGE_KEY = "pmis:document-wizard";
const STEP_MIN = 1;
const STEP_MAX = 4;

const STEP_META = [
  {
    step: 1,
    title: "기본 정보",
    description: "문서 메타정보와 본문을 입력합니다.",
  },
  {
    step: 2,
    title: "첨부 등록",
    description: "관련 파일을 업로드하고 정리합니다.",
  },
  {
    step: 3,
    title: "결재선 구성",
    description: "승인 순서와 역할을 설정합니다.",
  },
  {
    step: 4,
    title: "최종 발송",
    description: "작성 내용을 검토하고 발송합니다.",
  },
] as const;

const initialState: WizardState = {
  docNo: "",
  title: "",
  content: "",
  ledgerType: "general",
  direction: "internal",
  categoryCode: "",
  senderName: "",
  receiverName: "",
  attachments: [],
  approvalLines: [],
};

function parseStep(rawValue: string): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return STEP_MIN;
  }
  return Math.max(STEP_MIN, Math.min(STEP_MAX, Math.floor(parsed)));
}

function formatCurrentTime(): string {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DocumentWizardStepPage() {
  const params = useParams<{ step: string }>();
  const router = useRouter();
  const step = parseStep(String(params.step ?? "1"));
  const stepMeta = STEP_META.find((item) => item.step === step) ?? STEP_META[0];
  const progressPercent = ((step - STEP_MIN) / (STEP_MAX - STEP_MIN)) * 100;

  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [state, setState] = useState<WizardState>(initialState);
  const [approverName, setApproverName] = useState("");
  const [approverRoleTitle, setApproverRoleTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [previewDocNo, setPreviewDocNo] = useState("");
  const [isLoadingDocNo, setIsLoadingDocNo] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const draftReadyRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<WizardState>;
      setState((prev) => ({
        ...prev,
        ...parsed,
        docNo: "",
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        approvalLines: Array.isArray(parsed.approvalLines) ? parsed.approvalLines : [],
      }));
    } catch {
      // ignore invalid localStorage content
    } finally {
      draftReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftReadyRef.current) {
      return;
    }

    setSaveState("saving");
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveState("saved");
      setLastSavedAt(formatCurrentTime());
    }, 450);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state]);

  useEffect(() => {
    if (!message) {
      return;
    }
    setToast({ tone: "success", message });
  }, [message]);

  useEffect(() => {
    if (!error) {
      return;
    }
    setToast({ tone: "error", message: error });
  }, [error]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

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
    if (isUserLoading) {
      return;
    }

    void loadPreviewDocNo();
  }, [isUserLoading, loadPreviewDocNo]);

  function updateState<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function saveDraftNow() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveState("saved");
    setLastSavedAt(formatCurrentTime());
    setMessage("임시저장되었습니다.");
  }

  async function handleUpload(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);
    try {
      const uploaded: WizardAttachment[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("module", "documents");
        if (user.userId) {
          formData.append("uploadedBy", user.userId);
        }

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json()) as UploadResponse;
        if (!result.ok || !result.data) {
          throw new Error(result.error ?? "첨부 업로드 실패");
        }
        uploaded.push({
          fileAssetId: result.data.fileAssetId,
          fileName: result.data.originalName,
        });
      }

      setState((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...uploaded],
      }));
      setMessage(`${uploaded.length}개 파일이 업로드되었습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "첨부 업로드 실패");
    } finally {
      setIsUploading(false);
    }
  }

  function handleAddApprovalLine() {
    const name = approverName.trim();
    if (!name) {
      return;
    }

    setState((prev) => ({
      ...prev,
      approvalLines: [
        ...prev.approvalLines,
        {
          order: prev.approvalLines.length + 1,
          approverName: name,
          approverRoleTitle: approverRoleTitle.trim(),
        },
      ],
    }));
    setApproverName("");
    setApproverRoleTitle("");
  }

  function removeApprovalLine(order: number) {
    setState((prev) => ({
      ...prev,
      approvalLines: prev.approvalLines
        .filter((line) => line.order !== order)
        .map((line, index) => ({ ...line, order: index + 1 })),
    }));
  }

  function removeAttachment(fileAssetId: string) {
    setState((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((row) => row.fileAssetId !== fileAssetId),
    }));
  }

  async function handleSubmitDocument() {
    if (!canWrite) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      if (!state.title.trim()) {
        throw new Error("문서 제목을 입력해 주세요.");
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state,
          docNo: "",
          status: "in_review",
          attachments: state.attachments,
          approvalLines: state.approvalLines,
        }),
      });
      const result = (await response.json()) as { ok: boolean; data?: { docNo?: string }; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "문서 발송 실패");
      }
      setMessage(`문서가 발송되었습니다. (${result.data?.docNo ?? "번호 자동생성"})`);
      setState(initialState);
      window.localStorage.removeItem(STORAGE_KEY);
      setSaveState("idle");
      setLastSavedAt(null);
      void loadPreviewDocNo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "문서 발송 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function moveStep(nextStep: number) {
    router.push(`/design-docs/documents/wizard/${nextStep}`);
  }

  return (
    <section className="relative space-y-5 rounded-xl border border-border bg-background-card p-6 pb-28 shadow-[var(--shadow-soft)]">
      {toast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
          <div
            className={`min-w-[16rem] rounded-md border px-3 py-2 text-sm shadow-[var(--shadow-soft)] ${
              toast.tone === "success"
                ? "border-success/30 bg-success/10 text-foreground"
                : "border-danger/30 bg-danger/10 text-foreground"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">문서 작성 플로우</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Step {step} / 4 · {stepMeta.description}
            </p>
          </div>
          <div
            className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium ${
              saveState === "saving"
                ? "border-warning/30 bg-warning/10 text-foreground"
                : saveState === "saved"
                  ? "border-success/30 bg-success/10 text-foreground"
                  : "border-border bg-background-soft text-foreground-muted"
            }`}
          >
            {saveState === "saving"
              ? "자동저장 중..."
              : saveState === "saved"
                ? `자동저장 완료${lastSavedAt ? ` · ${lastSavedAt}` : ""}`
                : "자동저장 대기"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background-soft p-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-background-card">
            <div
              className="h-full rounded-full bg-[#8a8884] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <nav className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {STEP_META.map((item) => {
              const isActive = item.step === step;
              const isCompleted = item.step < step;

              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => moveStep(item.step)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-border-strong bg-[#ecebe8] text-foreground"
                      : isCompleted
                        ? "border-border bg-background-card text-foreground"
                        : "border-border bg-background text-foreground-muted hover:bg-background-card hover:text-foreground"
                  }`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide">
                    Step {item.step}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{item.title}</div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {canWrite ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3 rounded-xl border border-border bg-background-soft p-4">
              {step === 1 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">문서번호</span>
                    <input
                      value={previewDocNo || (isLoadingDocNo ? "자동 채번 중..." : "자동 생성 예정")}
                      readOnly
                      className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none"
                    />
                    <p className="text-xs text-foreground-muted">
                      문서번호는 발송 시점 기준으로 자동 채번됩니다.
                    </p>
                  </label>
                  <FormInput label="문서제목" value={state.title} onChange={(event) => updateState("title", event.target.value)} required />
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">대장구분</span>
                    <select
                      value={state.ledgerType}
                      onChange={(event) => updateState("ledgerType", event.target.value as WizardState["ledgerType"])}
                      className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    >
                      <option value="general">일반</option>
                      <option value="instruction">업무지시</option>
                      <option value="outbound">발송</option>
                      <option value="inbound">접수</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">문서방향</span>
                    <select
                      value={state.direction}
                      onChange={(event) => updateState("direction", event.target.value as WizardState["direction"])}
                      className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    >
                      <option value="internal">내부</option>
                      <option value="outbound">발신</option>
                      <option value="inbound">수신</option>
                    </select>
                  </label>
                  <FormInput label="분류코드" value={state.categoryCode} onChange={(event) => updateState("categoryCode", event.target.value.toUpperCase())} />
                  <FormInput label="발신" value={state.senderName} onChange={(event) => updateState("senderName", event.target.value)} />
                  <FormInput label="수신" value={state.receiverName} onChange={(event) => updateState("receiverName", event.target.value)} />
                  <label className="md:col-span-2 block space-y-1">
                    <span className="text-sm font-medium text-foreground">내용</span>
                    <textarea
                      value={state.content}
                      onChange={(event) => updateState("content", event.target.value)}
                      rows={8}
                      className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3">
                  <FileUpload label="첨부파일" multiple onFilesChange={(files) => void handleUpload(files)} />
                  {state.attachments.length > 0 ? (
                    <ul className="space-y-2">
                      {state.attachments.map((file) => (
                        <li key={file.fileAssetId} className="flex items-center justify-between rounded border border-border bg-background-card px-3 py-2 text-sm text-foreground">
                          <span>{file.fileName}</span>
                          <button type="button" onClick={() => removeAttachment(file.fileAssetId)} className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10">
                            제거
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-foreground-muted">업로드된 첨부가 없습니다.</p>
                  )}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <FormInput label="결재자명" value={approverName} onChange={(event) => setApproverName(event.target.value)} />
                    <FormInput label="직책/역할" value={approverRoleTitle} onChange={(event) => setApproverRoleTitle(event.target.value)} />
                    <button type="button" onClick={handleAddApprovalLine} className="mt-6 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft">
                      결재선 추가
                    </button>
                  </div>
                  {state.approvalLines.length > 0 ? (
                    <ul className="space-y-2">
                      {state.approvalLines.map((line) => (
                        <li key={line.order} className="flex items-center justify-between rounded border border-border bg-background-card px-3 py-2 text-sm text-foreground">
                          <span>
                            {line.order}. {line.approverName} {line.approverRoleTitle ? `(${line.approverRoleTitle})` : ""}
                          </span>
                          <button type="button" onClick={() => removeApprovalLine(line.order)} className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10">
                            제거
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-foreground-muted">등록된 결재선이 없습니다.</p>
                  )}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-background-card p-4">
                    <p className="text-sm text-foreground">
                      <strong>제목:</strong> {state.title || "-"}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      <strong>대장/방향:</strong> {state.ledgerType} / {state.direction}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      <strong>첨부:</strong> {state.attachments.length}건
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      <strong>결재선:</strong> {state.approvalLines.length}명
                    </p>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    하단 액션바의 `발송` 버튼으로 문서를 최종 발송합니다.
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="h-fit space-y-3 rounded-xl border border-border bg-background-card p-4 xl:sticky xl:top-20">
              <h2 className="text-sm font-semibold text-foreground">실시간 요약</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-foreground-muted">현재 단계</dt>
                  <dd className="font-medium text-foreground">{stepMeta.title}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-foreground-muted">문서 제목</dt>
                  <dd className="max-w-[12rem] truncate text-right font-medium text-foreground">
                    {state.title || "-"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-foreground-muted">대장/방향</dt>
                  <dd className="text-right font-medium text-foreground">
                    {state.ledgerType} / {state.direction}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-foreground-muted">첨부</dt>
                  <dd className="font-medium text-foreground">{state.attachments.length}건</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-foreground-muted">결재선</dt>
                  <dd className="font-medium text-foreground">{state.approvalLines.length}명</dd>
                </div>
              </dl>

              <div className="rounded-md border border-border bg-background-soft p-3 text-xs text-foreground-muted">
                {step === 1
                  ? "제목/본문/수발신 정보를 먼저 채우면 이후 단계 진행이 빠릅니다."
                  : step === 2
                    ? "필수 첨부가 있으면 이 단계에서 모두 등록하는 것을 권장합니다."
                    : step === 3
                      ? "결재선 순서는 문서 발송 순서와 동일합니다."
                      : "발송 전에 요약 정보와 첨부/결재선을 최종 확인하세요."}
              </div>
            </aside>
          </div>

          <div className="sticky bottom-3 z-20 rounded-xl border border-border-strong bg-background-card/95 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href="/design-docs/documents/search" className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft">
                문서검색
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveDraftNow}
                  disabled={isSubmitting || isUploading}
                  className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
                >
                  임시저장
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(Math.max(STEP_MIN, step - 1))}
                  disabled={step === STEP_MIN}
                  className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
                >
                  이전
                </button>
                {step < STEP_MAX ? (
                  <button
                    type="button"
                    onClick={() => moveStep(Math.min(STEP_MAX, step + 1))}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    다음
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSubmitDocument()}
                    disabled={isSubmitting || isUploading}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
                  >
                    발송
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">문서 작성 플로우는 `manager` 이상 권한이 필요합니다.</p>
      )}
    </section>
  );
}

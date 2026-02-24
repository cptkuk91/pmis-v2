"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const STORAGE_KEY = "pmis:document-wizard";
const STEP_MIN = 1;
const STEP_MAX = 4;

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

export default function DocumentWizardStepPage() {
  const params = useParams<{ step: string }>();
  const router = useRouter();
  const step = parseStep(String(params.step ?? "1"));

  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [state, setState] = useState<WizardState>(initialState);
  const [approverName, setApproverName] = useState("");
  const [approverRoleTitle, setApproverRoleTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        approvalLines: Array.isArray(parsed.approvalLines) ? parsed.approvalLines : [],
      }));
    } catch {
      // ignore invalid localStorage content
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function updateState<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
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
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">문서작성 위저드</h1>
        <p className="mt-1 text-sm text-foreground-muted">Step {step} / 4</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
        {[1, 2, 3, 4].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => moveStep(s)}
            className={`rounded-full px-3 py-1 ${
              s === step ? "bg-primary text-white" : "bg-background-soft text-foreground-muted"
            }`}
          >
            {s}. {s === 1 ? "입력" : s === 2 ? "첨부" : s === 3 ? "결재선" : "발송"}
          </button>
        ))}
      </div>

      {canWrite ? (
        <>
          {step === 1 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormInput label="문서번호(선택)" value={state.docNo} onChange={(event) => updateState("docNo", event.target.value)} />
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
                    <li key={file.fileAssetId} className="flex items-center justify-between rounded border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
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
                <button type="button" onClick={handleAddApprovalLine} className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card">
                  결재선 추가
                </button>
              </div>
              {state.approvalLines.length > 0 ? (
                <ul className="space-y-2">
                  {state.approvalLines.map((line) => (
                    <li key={line.order} className="flex items-center justify-between rounded border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
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
              <div className="rounded-lg border border-border bg-background-soft p-4">
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
              <button
                type="button"
                onClick={() => void handleSubmitDocument()}
                disabled={isSubmitting || isUploading}
                className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
              >
                발송 (in_review)
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveStep(Math.max(STEP_MIN, step - 1))}
              disabled={step === STEP_MIN}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => moveStep(Math.min(STEP_MAX, step + 1))}
              disabled={step === STEP_MAX}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              다음
            </button>
            <Link href="/design-docs/documents/search" className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft">
              문서검색
            </Link>
          </div>
        </>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">문서작성 위저드는 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}

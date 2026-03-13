import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { isQcAttachmentCategory, type QcAttachmentCategory } from "@/lib/qc-core";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES,
  QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES,
  QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES,
  QC_PROCESS_INSPECTION_RESULT_VALUES,
  QC_PROCESS_INSPECTION_STATUS_VALUES,
  isQcProcessInspectionCheckStatus,
  isQcProcessInspectionCorrectiveActionStatus,
  isQcProcessInspectionIssueStatus,
  isQcProcessInspectionResult,
  isQcProcessInspectionStatus,
  type QcProcessInspectionCheckStatus,
  type QcProcessInspectionCorrectiveActionStatus,
  type QcProcessInspectionIssueStatus,
  type QcProcessInspectionResult,
  type QcProcessInspectionStatus,
} from "@/lib/qc-process-inspections";

export type QcProcessInspectionAttachmentPayload = {
  fileAssetId: string;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcProcessInspectionChecklistItemPayload = {
  itemId: string;
  label: string;
  status: QcProcessInspectionCheckStatus;
  note: string;
};

export type QcProcessInspectionPayload = {
  workType: string;
  location: string;
  processStep: string;
  inspectionTitle: string;
  plannedInspectionDate: Date | null;
  actualInspectionDate: Date | null;
  status: QcProcessInspectionStatus;
  result: QcProcessInspectionResult;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  linkedItpPlanId: string;
  linkedItpCheckpointId: string;
  acceptanceCriteria: string;
  checklistItems: QcProcessInspectionChecklistItemPayload[];
  inspectionNotes: string;
  correctiveActionStatus: QcProcessInspectionCorrectiveActionStatus;
  correctiveActionRequest: string;
  correctiveActionDueDate: Date | null;
  correctiveActionSummary: string;
  attachments: QcProcessInspectionAttachmentPayload[];
  issueStatus: QcProcessInspectionIssueStatus;
  issueReference: string;
  historyNote: string;
};

type NormalizeOptions = {
  partial?: boolean;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDate(value: unknown, fieldLabel: string): Date | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

function parseObjectId(value: unknown, fieldLabel: string): string {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw VALIDATION_ERROR(`${fieldLabel} 식별자 형식이 올바르지 않습니다.`);
  }
  return raw;
}

function parseStatus(value: unknown): QcProcessInspectionStatus {
  const raw = normalizeText(value) || "scheduled";
  if (!isQcProcessInspectionStatus(raw)) {
    throw VALIDATION_ERROR(`공정 검사 상태는 ${QC_PROCESS_INSPECTION_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseResult(value: unknown): QcProcessInspectionResult {
  const raw = normalizeText(value) || "pending";
  if (!isQcProcessInspectionResult(raw)) {
    throw VALIDATION_ERROR(`검사 결과는 ${QC_PROCESS_INSPECTION_RESULT_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseCorrectiveActionStatus(value: unknown): QcProcessInspectionCorrectiveActionStatus {
  const raw = normalizeText(value) || "none";
  if (!isQcProcessInspectionCorrectiveActionStatus(raw)) {
    throw VALIDATION_ERROR(
      `시정조치 상태는 ${QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function parseIssueStatus(value: unknown): QcProcessInspectionIssueStatus {
  const raw = normalizeText(value) || "none";
  if (!isQcProcessInspectionIssueStatus(raw)) {
    throw VALIDATION_ERROR(`이슈 상태는 ${QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseAttachments(body: Record<string, unknown>) {
  const rows = Array.isArray(body.attachments) ? body.attachments : [];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => {
      const fileAssetId = parseObjectId(row.fileAssetId, "첨부 파일");
      if (!fileAssetId) {
        return null;
      }
      const fileName = normalizeText(row.fileName) || fileAssetId;
      const category = normalizeText(row.category) || "other";
      if (!isQcAttachmentCategory(category)) {
        throw VALIDATION_ERROR("첨부 구분 값이 올바르지 않습니다.");
      }
      const sortOrderValue = Number(row.sortOrder ?? index);
      return {
        fileAssetId,
        fileName,
        category,
        sortOrder: Number.isFinite(sortOrderValue) ? Math.max(0, Math.floor(sortOrderValue)) : index,
      };
    })
    .filter((row): row is QcProcessInspectionAttachmentPayload => Boolean(row));
}

function parseChecklistItems(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => {
      const label = normalizeText(row.label);
      if (!label) {
        return null;
      }
      assertNoUnsafeHtml(label, "체크리스트 항목");
      const status = normalizeText(row.status) || "pending";
      if (!isQcProcessInspectionCheckStatus(status)) {
        throw VALIDATION_ERROR(
          `체크리스트 상태는 ${QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
        );
      }
      const note = normalizeText(row.note);
      assertNoUnsafeHtml(note, "체크리스트 메모");
      return {
        itemId: normalizeText(row.itemId) || `check-${index + 1}`,
        label,
        status,
        note,
      };
    })
    .filter((row): row is QcProcessInspectionChecklistItemPayload => Boolean(row));
}

export function normalizeQcProcessInspectionPayload(
  body: Record<string, unknown>,
  options: { partial: true },
): Partial<QcProcessInspectionPayload>;
export function normalizeQcProcessInspectionPayload(
  body: Record<string, unknown>,
  options?: NormalizeOptions,
): QcProcessInspectionPayload;
export function normalizeQcProcessInspectionPayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
) {
  const partial = options.partial ?? false;
  const payload: Partial<QcProcessInspectionPayload> = {};

  if (!partial || body.workType !== undefined) {
    const workType = normalizeText(body.workType);
    if (!workType) {
      throw VALIDATION_ERROR("공종은 필수입니다.");
    }
    assertNoUnsafeHtml(workType, "공종");
    payload.workType = workType;
  }

  if (!partial || body.location !== undefined) {
    const location = normalizeText(body.location);
    if (!location) {
      throw VALIDATION_ERROR("위치는 필수입니다.");
    }
    assertNoUnsafeHtml(location, "위치");
    payload.location = location;
  }

  if (!partial || body.processStep !== undefined) {
    const processStep = normalizeText(body.processStep);
    if (!processStep) {
      throw VALIDATION_ERROR("공정 단계는 필수입니다.");
    }
    assertNoUnsafeHtml(processStep, "공정 단계");
    payload.processStep = processStep;
  }

  if (!partial || body.inspectionTitle !== undefined) {
    const inspectionTitle = normalizeText(body.inspectionTitle);
    if (!inspectionTitle) {
      throw VALIDATION_ERROR("검사 항목명은 필수입니다.");
    }
    assertNoUnsafeHtml(inspectionTitle, "검사 항목명");
    payload.inspectionTitle = inspectionTitle;
  }

  if (!partial || body.plannedInspectionDate !== undefined) {
    payload.plannedInspectionDate = parseDate(body.plannedInspectionDate, "검사 예정일");
    if (!partial && !payload.plannedInspectionDate) {
      throw VALIDATION_ERROR("검사 예정일은 필수입니다.");
    }
  }

  if (!partial || body.actualInspectionDate !== undefined) {
    payload.actualInspectionDate = parseDate(body.actualInspectionDate, "실제 검사일");
  }

  if (!partial || body.status !== undefined) {
    payload.status = parseStatus(body.status);
  }

  if (!partial || body.result !== undefined) {
    payload.result = parseResult(body.result);
  }

  if (!partial || body.requesterName !== undefined) {
    const requesterName = normalizeText(body.requesterName);
    assertNoUnsafeHtml(requesterName, "요청자");
    payload.requesterName = requesterName;
  }

  if (!partial || body.requesterMemberId !== undefined) {
    payload.requesterMemberId = parseObjectId(body.requesterMemberId, "요청자");
  }

  if (!partial || body.inspectorName !== undefined) {
    const inspectorName = normalizeText(body.inspectorName);
    assertNoUnsafeHtml(inspectorName, "검사자");
    payload.inspectorName = inspectorName;
  }

  if (!partial || body.inspectorMemberId !== undefined) {
    payload.inspectorMemberId = parseObjectId(body.inspectorMemberId, "검사자");
  }

  if (!partial || body.verifierName !== undefined) {
    const verifierName = normalizeText(body.verifierName);
    assertNoUnsafeHtml(verifierName, "확인자");
    payload.verifierName = verifierName;
  }

  if (!partial || body.verifierMemberId !== undefined) {
    payload.verifierMemberId = parseObjectId(body.verifierMemberId, "확인자");
  }

  if (!partial || body.linkedItpPlanId !== undefined) {
    payload.linkedItpPlanId = parseObjectId(body.linkedItpPlanId, "ITP");
  }

  if (!partial || body.linkedItpCheckpointId !== undefined) {
    const linkedItpCheckpointId = normalizeText(body.linkedItpCheckpointId);
    assertNoUnsafeHtml(linkedItpCheckpointId, "ITP 체크포인트");
    payload.linkedItpCheckpointId = linkedItpCheckpointId;
  }

  if (!partial || body.acceptanceCriteria !== undefined) {
    const acceptanceCriteria = normalizeText(body.acceptanceCriteria);
    assertNoUnsafeHtml(acceptanceCriteria, "판정 기준");
    payload.acceptanceCriteria = acceptanceCriteria;
  }

  if (!partial || body.checklistItems !== undefined) {
    payload.checklistItems = parseChecklistItems(body.checklistItems);
  }

  if (!partial || body.inspectionNotes !== undefined) {
    const inspectionNotes = normalizeText(body.inspectionNotes);
    assertNoUnsafeHtml(inspectionNotes, "검사 메모");
    payload.inspectionNotes = inspectionNotes;
  }

  if (!partial || body.correctiveActionStatus !== undefined) {
    payload.correctiveActionStatus = parseCorrectiveActionStatus(body.correctiveActionStatus);
  }

  if (!partial || body.correctiveActionRequest !== undefined) {
    const correctiveActionRequest = normalizeText(body.correctiveActionRequest);
    assertNoUnsafeHtml(correctiveActionRequest, "시정조치 요청");
    payload.correctiveActionRequest = correctiveActionRequest;
  }

  if (!partial || body.correctiveActionDueDate !== undefined) {
    payload.correctiveActionDueDate = parseDate(body.correctiveActionDueDate, "시정조치 기한");
  }

  if (!partial || body.correctiveActionSummary !== undefined) {
    const correctiveActionSummary = normalizeText(body.correctiveActionSummary);
    assertNoUnsafeHtml(correctiveActionSummary, "조치 결과");
    payload.correctiveActionSummary = correctiveActionSummary;
  }

  if (!partial || body.attachments !== undefined) {
    payload.attachments = parseAttachments(body);
  }

  if (!partial || body.issueStatus !== undefined) {
    payload.issueStatus = parseIssueStatus(body.issueStatus);
  }

  if (!partial || body.issueReference !== undefined) {
    const issueReference = normalizeText(body.issueReference);
    assertNoUnsafeHtml(issueReference, "이슈 참조");
    payload.issueReference = issueReference;
  }

  if (!partial || body.historyNote !== undefined) {
    const historyNote = normalizeText(body.historyNote);
    assertNoUnsafeHtml(historyNote, "이력 메모");
    payload.historyNote = historyNote;
  }

  if (partial) {
    return payload;
  }

  return {
    workType: payload.workType ?? "",
    location: payload.location ?? "",
    processStep: payload.processStep ?? "",
    inspectionTitle: payload.inspectionTitle ?? "",
    plannedInspectionDate: payload.plannedInspectionDate ?? null,
    actualInspectionDate: payload.actualInspectionDate ?? null,
    status: payload.status ?? "scheduled",
    result: payload.result ?? "pending",
    requesterName: payload.requesterName ?? "",
    requesterMemberId: payload.requesterMemberId ?? "",
    inspectorName: payload.inspectorName ?? "",
    inspectorMemberId: payload.inspectorMemberId ?? "",
    verifierName: payload.verifierName ?? "",
    verifierMemberId: payload.verifierMemberId ?? "",
    linkedItpPlanId: payload.linkedItpPlanId ?? "",
    linkedItpCheckpointId: payload.linkedItpCheckpointId ?? "",
    acceptanceCriteria: payload.acceptanceCriteria ?? "",
    checklistItems: payload.checklistItems ?? [],
    inspectionNotes: payload.inspectionNotes ?? "",
    correctiveActionStatus: payload.correctiveActionStatus ?? "none",
    correctiveActionRequest: payload.correctiveActionRequest ?? "",
    correctiveActionDueDate: payload.correctiveActionDueDate ?? null,
    correctiveActionSummary: payload.correctiveActionSummary ?? "",
    attachments: payload.attachments ?? [],
    issueStatus: payload.issueStatus ?? "none",
    issueReference: payload.issueReference ?? "",
    historyNote: payload.historyNote ?? "",
  };
}

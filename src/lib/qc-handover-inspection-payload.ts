import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { isQcAttachmentCategory, type QcAttachmentCategory } from "@/lib/qc-core";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QC_HANDOVER_APPROVAL_STATUS_VALUES,
  QC_HANDOVER_AREA_TYPE_VALUES,
  QC_HANDOVER_CHECK_STATUS_VALUES,
  QC_HANDOVER_FINDING_STATUS_VALUES,
  QC_HANDOVER_INSPECTION_TYPE_VALUES,
  QC_HANDOVER_STATUS_VALUES,
  isQcHandoverApprovalStatus,
  isQcHandoverAreaType,
  isQcHandoverCheckStatus,
  isQcHandoverFindingStatus,
  isQcHandoverInspectionType,
  isQcHandoverStatus,
  type QcHandoverApprovalStatus,
  type QcHandoverAreaType,
  type QcHandoverCheckStatus,
  type QcHandoverFindingStatus,
  type QcHandoverInspectionType,
  type QcHandoverStatus,
} from "@/lib/qc-handover-inspections";

export type QcHandoverInspectionAttachmentPayload = {
  fileAssetId: string;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcHandoverInspectionChecklistItemPayload = {
  itemId: string;
  sectionTitle: string;
  checkpointTitle: string;
  spaceLabel: string;
  status: QcHandoverCheckStatus;
  note: string;
  findingTitle: string;
  correctiveRequest: string;
  correctiveDueDate: Date | null;
  findingStatus: QcHandoverFindingStatus;
  completionNote: string;
};

export type QcHandoverInspectionPayload = {
  inspectionType: QcHandoverInspectionType;
  inspectionTitle: string;
  workType: string;
  areaType: QcHandoverAreaType;
  areaLabel: string;
  unitNo: string;
  zoneName: string;
  plannedInspectionDate: Date | null;
  inspectedAt: Date | null;
  status: QcHandoverStatus;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  approverName: string;
  approverMemberId: string;
  approvalStatus: QcHandoverApprovalStatus;
  approvedAt: Date | null;
  approvalComment: string;
  inspectionSummary: string;
  linkedProcessInspectionId: string;
  linkedNcrId: string;
  checklistItems: QcHandoverInspectionChecklistItemPayload[];
  attachments: QcHandoverInspectionAttachmentPayload[];
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

function parseInspectionType(value: unknown): QcHandoverInspectionType {
  const raw = normalizeText(value) || "acceptance";
  if (!isQcHandoverInspectionType(raw)) {
    throw VALIDATION_ERROR(
      `검사 구분은 ${QC_HANDOVER_INSPECTION_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function parseAreaType(value: unknown): QcHandoverAreaType {
  const raw = normalizeText(value) || "space";
  if (!isQcHandoverAreaType(raw)) {
    throw VALIDATION_ERROR(`영역 구분은 ${QC_HANDOVER_AREA_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseStatus(value: unknown): QcHandoverStatus {
  const raw = normalizeText(value) || "scheduled";
  if (!isQcHandoverStatus(raw)) {
    throw VALIDATION_ERROR(`검사 상태는 ${QC_HANDOVER_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseApprovalStatus(value: unknown): QcHandoverApprovalStatus {
  const raw = normalizeText(value) || "none";
  if (!isQcHandoverApprovalStatus(raw)) {
    throw VALIDATION_ERROR(
      `승인 상태는 ${QC_HANDOVER_APPROVAL_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function parseChecklistStatus(value: unknown): QcHandoverCheckStatus {
  const raw = normalizeText(value) || "pending";
  if (!isQcHandoverCheckStatus(raw)) {
    throw VALIDATION_ERROR(
      `체크리스트 판정은 ${QC_HANDOVER_CHECK_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function parseFindingStatus(value: unknown): QcHandoverFindingStatus {
  const raw = normalizeText(value) || "none";
  if (!isQcHandoverFindingStatus(raw)) {
    throw VALIDATION_ERROR(
      `지적사항 상태는 ${QC_HANDOVER_FINDING_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
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
    .filter((row): row is QcHandoverInspectionAttachmentPayload => Boolean(row));
}

function parseChecklistItems(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => {
      const checkpointTitle = normalizeText(row.checkpointTitle);
      if (!checkpointTitle) {
        return null;
      }
      const sectionTitle = normalizeText(row.sectionTitle);
      const spaceLabel = normalizeText(row.spaceLabel);
      const note = normalizeText(row.note);
      const findingTitle = normalizeText(row.findingTitle);
      const correctiveRequest = normalizeText(row.correctiveRequest);
      const completionNote = normalizeText(row.completionNote);
      assertNoUnsafeHtml(sectionTitle, "체크리스트 분류");
      assertNoUnsafeHtml(checkpointTitle, "체크리스트 항목");
      assertNoUnsafeHtml(spaceLabel, "공간/세대/구역");
      assertNoUnsafeHtml(note, "체크 메모");
      assertNoUnsafeHtml(findingTitle, "지적사항");
      assertNoUnsafeHtml(correctiveRequest, "보완 요청");
      assertNoUnsafeHtml(completionNote, "완료 메모");
      return {
        itemId: normalizeText(row.itemId) || `handover-check-${index + 1}`,
        sectionTitle,
        checkpointTitle,
        spaceLabel,
        status: parseChecklistStatus(row.status),
        note,
        findingTitle,
        correctiveRequest,
        correctiveDueDate: parseDate(row.correctiveDueDate, "보완 기한"),
        findingStatus: parseFindingStatus(row.findingStatus),
        completionNote,
      };
    })
    .filter((row): row is QcHandoverInspectionChecklistItemPayload => Boolean(row));
}

export function normalizeQcHandoverInspectionPayload(
  body: Record<string, unknown>,
  options: { partial: true },
): Partial<QcHandoverInspectionPayload>;
export function normalizeQcHandoverInspectionPayload(
  body: Record<string, unknown>,
  options?: NormalizeOptions,
): QcHandoverInspectionPayload;
export function normalizeQcHandoverInspectionPayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
) {
  const partial = options.partial ?? false;
  const payload: Partial<QcHandoverInspectionPayload> = {};

  if (!partial || body.inspectionType !== undefined) {
    payload.inspectionType = parseInspectionType(body.inspectionType);
  }

  if (!partial || body.inspectionTitle !== undefined) {
    const inspectionTitle = normalizeText(body.inspectionTitle);
    if (!inspectionTitle) {
      throw VALIDATION_ERROR("검사명은 필수입니다.");
    }
    assertNoUnsafeHtml(inspectionTitle, "검사명");
    payload.inspectionTitle = inspectionTitle;
  }

  if (!partial || body.workType !== undefined) {
    const workType = normalizeText(body.workType);
    if (!workType) {
      throw VALIDATION_ERROR("공종은 필수입니다.");
    }
    assertNoUnsafeHtml(workType, "공종");
    payload.workType = workType;
  }

  if (!partial || body.areaType !== undefined) {
    payload.areaType = parseAreaType(body.areaType);
  }

  if (!partial || body.areaLabel !== undefined) {
    const areaLabel = normalizeText(body.areaLabel);
    assertNoUnsafeHtml(areaLabel, "영역");
    payload.areaLabel = areaLabel;
  }

  if (!partial || body.unitNo !== undefined) {
    const unitNo = normalizeText(body.unitNo);
    assertNoUnsafeHtml(unitNo, "세대");
    payload.unitNo = unitNo;
  }

  if (!partial || body.zoneName !== undefined) {
    const zoneName = normalizeText(body.zoneName);
    assertNoUnsafeHtml(zoneName, "구역");
    payload.zoneName = zoneName;
  }

  if (!partial || body.plannedInspectionDate !== undefined) {
    payload.plannedInspectionDate = parseDate(body.plannedInspectionDate, "검사 예정일");
    if (!partial && !payload.plannedInspectionDate) {
      throw VALIDATION_ERROR("검사 예정일은 필수입니다.");
    }
  }

  if (!partial || body.inspectedAt !== undefined) {
    payload.inspectedAt = parseDate(body.inspectedAt, "실제 검사일");
  }

  if (!partial || body.status !== undefined) {
    payload.status = parseStatus(body.status);
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

  if (!partial || body.approverName !== undefined) {
    const approverName = normalizeText(body.approverName);
    assertNoUnsafeHtml(approverName, "승인자");
    payload.approverName = approverName;
  }

  if (!partial || body.approverMemberId !== undefined) {
    payload.approverMemberId = parseObjectId(body.approverMemberId, "승인자");
  }

  if (!partial || body.approvalStatus !== undefined) {
    payload.approvalStatus = parseApprovalStatus(body.approvalStatus);
  }

  if (!partial || body.approvedAt !== undefined) {
    payload.approvedAt = parseDate(body.approvedAt, "승인일");
  }

  if (!partial || body.approvalComment !== undefined) {
    const approvalComment = normalizeText(body.approvalComment);
    assertNoUnsafeHtml(approvalComment, "승인 메모");
    payload.approvalComment = approvalComment;
  }

  if (!partial || body.inspectionSummary !== undefined) {
    const inspectionSummary = normalizeText(body.inspectionSummary);
    assertNoUnsafeHtml(inspectionSummary, "검사 요약");
    payload.inspectionSummary = inspectionSummary;
  }

  if (!partial || body.linkedProcessInspectionId !== undefined) {
    payload.linkedProcessInspectionId = parseObjectId(body.linkedProcessInspectionId, "공정 검사");
  }

  if (!partial || body.linkedNcrId !== undefined) {
    payload.linkedNcrId = parseObjectId(body.linkedNcrId, "NCR");
  }

  if (!partial || body.checklistItems !== undefined) {
    payload.checklistItems = parseChecklistItems(body.checklistItems);
  }

  if (!partial || body.attachments !== undefined) {
    payload.attachments = parseAttachments(body);
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
    inspectionType: payload.inspectionType ?? "acceptance",
    inspectionTitle: payload.inspectionTitle ?? "",
    workType: payload.workType ?? "",
    areaType: payload.areaType ?? "space",
    areaLabel: payload.areaLabel ?? "",
    unitNo: payload.unitNo ?? "",
    zoneName: payload.zoneName ?? "",
    plannedInspectionDate: payload.plannedInspectionDate ?? null,
    inspectedAt: payload.inspectedAt ?? null,
    status: payload.status ?? "scheduled",
    requesterName: payload.requesterName ?? "",
    requesterMemberId: payload.requesterMemberId ?? "",
    inspectorName: payload.inspectorName ?? "",
    inspectorMemberId: payload.inspectorMemberId ?? "",
    approverName: payload.approverName ?? "",
    approverMemberId: payload.approverMemberId ?? "",
    approvalStatus: payload.approvalStatus ?? "none",
    approvedAt: payload.approvedAt ?? null,
    approvalComment: payload.approvalComment ?? "",
    inspectionSummary: payload.inspectionSummary ?? "",
    linkedProcessInspectionId: payload.linkedProcessInspectionId ?? "",
    linkedNcrId: payload.linkedNcrId ?? "",
    checklistItems: payload.checklistItems ?? [],
    attachments: payload.attachments ?? [],
    historyNote: payload.historyNote ?? "",
  };
}

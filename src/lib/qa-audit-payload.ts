import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QA_AUDIT_RESULT_VALUES,
  QA_AUDIT_STATUS_VALUES,
  QA_AUDIT_TYPE_VALUES,
  isQaAuditResult,
  isQaAuditStatus,
  isQaAuditType,
  type QaAuditResult,
  type QaAuditStatus,
  type QaAuditType,
} from "@/lib/qa-audits";

type ProcedureRefPayload = {
  procedureId: string;
  documentKey: string;
  title: string;
  versionNo: number;
};

type ChecklistItemPayload = {
  checklistId: string;
  sectionTitle: string;
  itemTitle: string;
  criteria: string;
  result: QaAuditResult;
  note: string;
  requiresCapa: boolean;
  linkedCapaId: string;
};

export type QaAuditPayload = {
  auditTitle: string;
  auditType: QaAuditType;
  status: QaAuditStatus;
  plannedDate: Date;
  actualDate: Date | null;
  auditeeName: string;
  scopeSummary: string;
  auditLeadName: string;
  auditLeadMemberId: string;
  linkedAssurancePlanId: string;
  linkedAssurancePlanTitle: string;
  linkedAssurancePlanYear: number | null;
  linkedAssurancePlanVersionNo: number | null;
  referencedProcedures: ProcedureRefPayload[];
  checklistItems: ChecklistItemPayload[];
  resultSummary: string;
  nonconformityCount: number;
  observationCount: number;
  capaRequestedCount: number;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDate(value: unknown, fieldName: string, required = false): Date | null {
  const raw = normalizeText(value);
  if (!raw) {
    if (required) {
      throw VALIDATION_ERROR(`${fieldName}은(는) 필수입니다.`);
    }
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

function parseStatus(value: unknown): QaAuditStatus {
  const raw = normalizeText(value) || "planned";
  if (!isQaAuditStatus(raw)) {
    throw VALIDATION_ERROR(`심사 상태는 ${QA_AUDIT_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseType(value: unknown): QaAuditType {
  const raw = normalizeText(value) || "regular";
  if (!isQaAuditType(raw)) {
    throw VALIDATION_ERROR(`심사 유형은 ${QA_AUDIT_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseOptionalNumber(value: unknown, fieldName: string, min = 1, max = 9999): number | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw VALIDATION_ERROR(`${fieldName} 값이 올바르지 않습니다.`);
  }
  return parsed;
}

function normalizeChecklistId(value: unknown, index: number): string {
  const candidate = normalizeText(value);
  return candidate || `audit-checklist-${Date.now()}-${index + 1}`;
}

function normalizeChecklistItem(value: unknown, index: number): ChecklistItemPayload {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sectionTitle = normalizeText(item.sectionTitle);
  const itemTitle = normalizeText(item.itemTitle);
  const criteria = normalizeText(item.criteria);
  const note = normalizeText(item.note);
  const linkedCapaId = normalizeText(item.linkedCapaId);
  const rawResult = normalizeText(item.result) || "conformity";

  if (!isQaAuditResult(rawResult)) {
    throw VALIDATION_ERROR(`점검 항목 ${index + 1}의 결과는 ${QA_AUDIT_RESULT_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  if (!sectionTitle) {
    throw VALIDATION_ERROR(`점검 항목 ${index + 1}의 점검 구분은 필수입니다.`);
  }
  if (!itemTitle) {
    throw VALIDATION_ERROR(`점검 항목 ${index + 1}의 점검 항목명은 필수입니다.`);
  }
  if (!criteria) {
    throw VALIDATION_ERROR(`점검 항목 ${index + 1}의 기준은 필수입니다.`);
  }

  assertNoUnsafeHtml(sectionTitle, `점검 항목 ${index + 1} 구분`);
  assertNoUnsafeHtml(itemTitle, `점검 항목 ${index + 1} 항목명`);
  assertNoUnsafeHtml(criteria, `점검 항목 ${index + 1} 기준`);
  assertNoUnsafeHtml(note, `점검 항목 ${index + 1} 메모`);
  assertNoUnsafeHtml(linkedCapaId, `점검 항목 ${index + 1} CAPA ID`);

  const requiresCapa = rawResult === "nonconformity" ? Boolean(item.requiresCapa) : false;

  return {
    checklistId: normalizeChecklistId(item.checklistId, index),
    sectionTitle,
    itemTitle,
    criteria,
    result: rawResult,
    note,
    requiresCapa,
    linkedCapaId,
  };
}

function normalizeProcedureRef(value: unknown, index: number): ProcedureRefPayload {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const procedureId = normalizeText(item.procedureId);
  const documentKey = normalizeText(item.documentKey);
  const title = normalizeText(item.title);
  const versionNo = Number(item.versionNo ?? 0);

  if (!procedureId) {
    throw VALIDATION_ERROR(`참조 절차 ${index + 1}의 식별자가 없습니다.`);
  }
  if (!mongoose.Types.ObjectId.isValid(procedureId)) {
    throw VALIDATION_ERROR(`참조 절차 ${index + 1}의 식별자 형식이 올바르지 않습니다.`);
  }

  assertNoUnsafeHtml(documentKey, `참조 절차 ${index + 1} 문서키`);
  assertNoUnsafeHtml(title, `참조 절차 ${index + 1} 제목`);

  return {
    procedureId,
    documentKey,
    title,
    versionNo: Number.isInteger(versionNo) && versionNo > 0 ? versionNo : 1,
  };
}

export function normalizeQaAuditPayload(body: Record<string, unknown>): QaAuditPayload {
  const auditTitle = normalizeText(body.auditTitle);
  const auditeeName = normalizeText(body.auditeeName);
  const scopeSummary = normalizeText(body.scopeSummary);
  const auditLeadName = normalizeText(body.auditLeadName);
  const auditLeadMemberId = normalizeText(body.auditLeadMemberId);
  const linkedAssurancePlanId = normalizeText(body.linkedAssurancePlanId);
  const linkedAssurancePlanTitle = normalizeText(body.linkedAssurancePlanTitle);
  const resultSummary = normalizeText(body.resultSummary);
  const checklistItemsInput = Array.isArray(body.checklistItems) ? body.checklistItems : [];
  const referencedProceduresInput = Array.isArray(body.referencedProcedures) ? body.referencedProcedures : [];

  if (!auditTitle) {
    throw VALIDATION_ERROR("심사명은 필수입니다.");
  }
  if (!auditeeName) {
    throw VALIDATION_ERROR("심사 대상은 필수입니다.");
  }
  if (!scopeSummary) {
    throw VALIDATION_ERROR("심사 범위는 필수입니다.");
  }
  if (!auditLeadName) {
    throw VALIDATION_ERROR("심사 책임자는 필수입니다.");
  }
  if (!auditLeadMemberId) {
    throw VALIDATION_ERROR("심사 책임자는 현장 인력에서 선택해야 합니다.");
  }
  if (!mongoose.Types.ObjectId.isValid(auditLeadMemberId)) {
    throw VALIDATION_ERROR("심사 책임자 식별자 형식이 올바르지 않습니다.");
  }
  if (!checklistItemsInput.length) {
    throw VALIDATION_ERROR("점검 항목은 최소 1개 이상이어야 합니다.");
  }
  if (linkedAssurancePlanId && !mongoose.Types.ObjectId.isValid(linkedAssurancePlanId)) {
    throw VALIDATION_ERROR("연결 QAP 식별자 형식이 올바르지 않습니다.");
  }

  assertNoUnsafeHtml(auditTitle, "심사명");
  assertNoUnsafeHtml(auditeeName, "심사 대상");
  assertNoUnsafeHtml(scopeSummary, "심사 범위");
  assertNoUnsafeHtml(auditLeadName, "심사 책임자");
  assertNoUnsafeHtml(linkedAssurancePlanTitle, "연결 QAP");
  assertNoUnsafeHtml(resultSummary, "결과 요약");

  const auditType = parseType(body.auditType);
  const status = parseStatus(body.status);
  const plannedDate = parseDate(body.plannedDate, "예정일", true);
  const actualDate = parseDate(body.actualDate, "실시일");
  if (!plannedDate) {
    throw VALIDATION_ERROR("예정일은 필수입니다.");
  }
  if ((status === "completed" || status === "closed") && !actualDate) {
    throw VALIDATION_ERROR("심사가 완료되었으면 실시일이 필요합니다.");
  }

  const checklistItems = checklistItemsInput.map((item, index) => normalizeChecklistItem(item, index));
  const nonconformityCount = checklistItems.filter((item) => item.result === "nonconformity").length;
  const observationCount = checklistItems.filter((item) => item.result === "observation").length;
  const capaRequestedCount = checklistItems.filter((item) => item.result === "nonconformity" && item.requiresCapa).length;

  return {
    auditTitle,
    auditType,
    status,
    plannedDate,
    actualDate,
    auditeeName,
    scopeSummary,
    auditLeadName,
    auditLeadMemberId,
    linkedAssurancePlanId,
    linkedAssurancePlanTitle,
    linkedAssurancePlanYear: parseOptionalNumber(body.linkedAssurancePlanYear, "연결 QAP 연도", 2000, 2100),
    linkedAssurancePlanVersionNo: parseOptionalNumber(body.linkedAssurancePlanVersionNo, "연결 QAP 버전"),
    referencedProcedures: referencedProceduresInput.map((item, index) => normalizeProcedureRef(item, index)),
    checklistItems,
    resultSummary,
    nonconformityCount,
    observationCount,
    capaRequestedCount,
  };
}

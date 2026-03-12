import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QA_PROCEDURE_DOCUMENT_TYPE_VALUES,
  QA_PROCEDURE_SCOPE_TYPE_VALUES,
  QA_PROCEDURE_STATUS_VALUES,
  isQaProcedureDocumentType,
  isQaProcedureReferenceTarget,
  isQaProcedureScopeType,
  isQaProcedureStatus,
  type QaProcedureDocumentType,
  type QaProcedureReferenceTarget,
  type QaProcedureScopeType,
  type QaProcedureStatus,
} from "@/lib/qa-procedures";

export type QaProcedurePayload = {
  documentKey: string;
  categoryCode: string;
  documentType: QaProcedureDocumentType;
  title: string;
  summary: string;
  scopeType: QaProcedureScopeType;
  scopeSummary: string;
  versionNo: number;
  effectiveDate: Date | null;
  status: QaProcedureStatus;
  retiredAt: Date | null;
  isSiteRequired: boolean;
  referenceTargets: QaProcedureReferenceTarget[];
  externalDocUrl: string;
  fileAssetId: string;
  fileName: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseVersionNo(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99) {
    throw VALIDATION_ERROR("버전은 1~99 범위의 정수여야 합니다.");
  }
  return numeric;
}

function parseDate(value: unknown, fieldName: string): Date | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

function parseDocumentType(value: unknown): QaProcedureDocumentType {
  const raw = normalizeText(value) || "procedure";
  if (!isQaProcedureDocumentType(raw)) {
    throw VALIDATION_ERROR(`문서유형은 ${QA_PROCEDURE_DOCUMENT_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseScopeType(value: unknown): QaProcedureScopeType {
  const raw = normalizeText(value) || "common";
  if (!isQaProcedureScopeType(raw)) {
    throw VALIDATION_ERROR(`적용범위 유형은 ${QA_PROCEDURE_SCOPE_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseStatus(value: unknown): QaProcedureStatus {
  const raw = normalizeText(value) || "active";
  if (!isQaProcedureStatus(raw)) {
    throw VALIDATION_ERROR(`상태는 ${QA_PROCEDURE_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseExternalDocUrl(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("UNSUPPORTED_PROTOCOL");
    }
    return url.toString();
  } catch {
    throw VALIDATION_ERROR("외부 문서 URL 형식이 올바르지 않습니다.");
  }
}

function parseReferenceTargets(value: unknown): QaProcedureReferenceTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((item) => normalizeText(item))
    .filter((item): item is QaProcedureReferenceTarget => isQaProcedureReferenceTarget(item));

  return Array.from(new Set(normalized));
}

export function normalizeQaProcedurePayload(body: Record<string, unknown>): QaProcedurePayload {
  const documentKey = normalizeText(body.documentKey);
  const categoryCode = normalizeText(body.categoryCode).toUpperCase();
  const title = normalizeText(body.title);
  const summary = normalizeText(body.summary);
  const scopeSummary = normalizeText(body.scopeSummary);
  const fileAssetId = normalizeText(body.fileAssetId);
  const fileName = normalizeText(body.fileName);
  const status = parseStatus(body.status);
  const retiredAt = parseDate(body.retiredAt, "폐기일");

  if (!documentKey) {
    throw VALIDATION_ERROR("문서키는 필수입니다.");
  }
  if (!categoryCode) {
    throw VALIDATION_ERROR("카테고리는 필수입니다.");
  }
  if (!title) {
    throw VALIDATION_ERROR("제목은 필수입니다.");
  }
  if (!scopeSummary) {
    throw VALIDATION_ERROR("적용범위 설명은 필수입니다.");
  }
  if (!fileAssetId && !parseExternalDocUrl(body.externalDocUrl)) {
    throw VALIDATION_ERROR("첨부파일 또는 외부 문서 URL 중 하나는 필요합니다.");
  }
  if (fileAssetId && !mongoose.Types.ObjectId.isValid(fileAssetId)) {
    throw VALIDATION_ERROR("첨부파일 식별자 형식이 올바르지 않습니다.");
  }
  if (status === "retired" && !retiredAt) {
    throw VALIDATION_ERROR("폐기 상태인 경우 폐기일이 필요합니다.");
  }

  assertNoUnsafeHtml(documentKey, "문서키");
  assertNoUnsafeHtml(categoryCode, "카테고리");
  assertNoUnsafeHtml(title, "제목");
  assertNoUnsafeHtml(summary, "요약");
  assertNoUnsafeHtml(scopeSummary, "적용범위 설명");
  assertNoUnsafeHtml(fileName, "첨부파일명");

  const externalDocUrl = parseExternalDocUrl(body.externalDocUrl);

  return {
    documentKey,
    categoryCode,
    documentType: parseDocumentType(body.documentType),
    title,
    summary,
    scopeType: parseScopeType(body.scopeType),
    scopeSummary,
    versionNo: parseVersionNo(body.versionNo),
    effectiveDate: parseDate(body.effectiveDate, "시행일"),
    status,
    retiredAt,
    isSiteRequired: Boolean(body.isSiteRequired),
    referenceTargets: parseReferenceTargets(body.referenceTargets),
    externalDocUrl,
    fileAssetId,
    fileName,
  };
}

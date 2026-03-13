import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { isQcAttachmentCategory, type QcAttachmentCategory } from "@/lib/qc-core";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QC_TEST_REPORT_JUDGEMENT_RULE_VALUES,
  QC_TEST_REPORT_NCR_STATUS_VALUES,
  QC_TEST_REPORT_SOURCE_TYPE_VALUES,
  QC_TEST_REPORT_STATUS_VALUES,
  QC_TEST_REPORT_TYPE_VALUES,
  computeQcTestReportEvaluation,
  isQcTestReportJudgementRule,
  isQcTestReportNcrStatus,
  isQcTestReportSourceType,
  isQcTestReportStatus,
  isQcTestReportType,
  type QcTestReportJudgementRule,
  type QcTestReportNcrStatus,
  type QcTestReportResult,
  type QcTestReportSourceType,
  type QcTestReportStatus,
  type QcTestReportType,
} from "@/lib/qc-test-reports";

export type QcTestReportAttachmentPayload = {
  fileAssetId: string;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcTestReportPayload = {
  testType: QcTestReportType;
  sourceType: QcTestReportSourceType;
  sampleName: string;
  specimenNo: string;
  samplingLocation: string;
  samplingDate: Date | null;
  testDate: Date | null;
  linkedMaterialInspectionId: string;
  linkedProcessInspectionId: string;
  standardValue: number;
  measuredValue: number;
  toleranceValue: number;
  unit: string;
  judgementRule: QcTestReportJudgementRule;
  result: QcTestReportResult;
  deviationValue: number;
  deviationRate: number;
  testingAgency: string;
  certificateNo: string;
  versionNo: number;
  status: QcTestReportStatus;
  reviewerName: string;
  reviewerMemberId: string;
  approverName: string;
  approverMemberId: string;
  summary: string;
  attachments: QcTestReportAttachmentPayload[];
  ncrStatus: QcTestReportNcrStatus;
  ncrReference: string;
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

function parseNumber(value: unknown, fieldLabel: string, fallback = 0): number {
  const raw = normalizeText(value);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw VALIDATION_ERROR(`${fieldLabel}는 숫자여야 합니다.`);
  }
  return parsed;
}

function parsePositiveInt(value: unknown, fieldLabel: string, fallback = 1): number {
  const parsed = parseNumber(value, fieldLabel, fallback);
  if (parsed < 1) {
    throw VALIDATION_ERROR(`${fieldLabel}는 1 이상이어야 합니다.`);
  }
  return Math.floor(parsed);
}

function parseTestType(value: unknown): QcTestReportType {
  const raw = normalizeText(value) || "other";
  if (!isQcTestReportType(raw)) {
    throw VALIDATION_ERROR(`시험 구분은 ${QC_TEST_REPORT_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseSourceType(value: unknown): QcTestReportSourceType {
  const raw = normalizeText(value) || "manual";
  if (!isQcTestReportSourceType(raw)) {
    throw VALIDATION_ERROR(`출처 구분은 ${QC_TEST_REPORT_SOURCE_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseStatus(value: unknown): QcTestReportStatus {
  const raw = normalizeText(value) || "draft";
  if (!isQcTestReportStatus(raw)) {
    throw VALIDATION_ERROR(`상태는 ${QC_TEST_REPORT_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseJudgementRule(value: unknown): QcTestReportJudgementRule {
  const raw = normalizeText(value) || "minimum";
  if (!isQcTestReportJudgementRule(raw)) {
    throw VALIDATION_ERROR(`판정 규칙은 ${QC_TEST_REPORT_JUDGEMENT_RULE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseNcrStatus(value: unknown): QcTestReportNcrStatus {
  const raw = normalizeText(value) || "none";
  if (!isQcTestReportNcrStatus(raw)) {
    throw VALIDATION_ERROR(`NCR 상태는 ${QC_TEST_REPORT_NCR_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseAttachments(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => {
      const fileAssetId = parseObjectId(row.fileAssetId, "첨부 파일");
      if (!fileAssetId) {
        return null;
      }
      const fileName = normalizeText(row.fileName) || fileAssetId;
      const categoryRaw = normalizeText(row.category) || "other";
      if (!isQcAttachmentCategory(categoryRaw)) {
        throw VALIDATION_ERROR("첨부 구분 값이 올바르지 않습니다.");
      }
      const sortOrderValue = Number(row.sortOrder ?? index);
      const sortOrder = Number.isFinite(sortOrderValue) ? Math.max(0, Math.floor(sortOrderValue)) : index;
      return {
        fileAssetId,
        fileName,
        category: categoryRaw,
        sortOrder,
      };
    })
    .filter((row): row is QcTestReportAttachmentPayload => Boolean(row));
}

export function normalizeQcTestReportPayload(
  body: Record<string, unknown>,
  options: { partial: true },
): Partial<QcTestReportPayload>;
export function normalizeQcTestReportPayload(
  body: Record<string, unknown>,
  options?: NormalizeOptions,
): QcTestReportPayload;
export function normalizeQcTestReportPayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
) {
  const partial = options.partial ?? false;
  const payload: Partial<QcTestReportPayload> = {};

  if (!partial || body.testType !== undefined) {
    payload.testType = parseTestType(body.testType);
  }

  if (!partial || body.sourceType !== undefined) {
    payload.sourceType = parseSourceType(body.sourceType);
  }

  if (!partial || body.sampleName !== undefined) {
    const sampleName = normalizeText(body.sampleName);
    if (!sampleName) {
      throw VALIDATION_ERROR("시료명은 필수입니다.");
    }
    assertNoUnsafeHtml(sampleName, "시료명");
    payload.sampleName = sampleName;
  }

  if (!partial || body.specimenNo !== undefined) {
    const specimenNo = normalizeText(body.specimenNo);
    assertNoUnsafeHtml(specimenNo, "시료 번호");
    payload.specimenNo = specimenNo;
  }

  if (!partial || body.samplingLocation !== undefined) {
    const samplingLocation = normalizeText(body.samplingLocation);
    assertNoUnsafeHtml(samplingLocation, "채취 위치");
    payload.samplingLocation = samplingLocation;
  }

  if (!partial || body.samplingDate !== undefined) {
    payload.samplingDate = parseDate(body.samplingDate, "채취일");
    if (!partial && !payload.samplingDate) {
      throw VALIDATION_ERROR("채취일은 필수입니다.");
    }
  }

  if (!partial || body.testDate !== undefined) {
    payload.testDate = parseDate(body.testDate, "시험일");
    if (!partial && !payload.testDate) {
      throw VALIDATION_ERROR("시험일은 필수입니다.");
    }
  }

  if (!partial || body.linkedMaterialInspectionId !== undefined) {
    payload.linkedMaterialInspectionId = parseObjectId(body.linkedMaterialInspectionId, "자재 검사");
  }

  if (!partial || body.linkedProcessInspectionId !== undefined) {
    payload.linkedProcessInspectionId = parseObjectId(body.linkedProcessInspectionId, "공정 검사");
  }

  if (!partial || body.standardValue !== undefined) {
    payload.standardValue = parseNumber(body.standardValue, "기준값");
  }

  if (!partial || body.measuredValue !== undefined) {
    payload.measuredValue = parseNumber(body.measuredValue, "실측값");
  }

  if (!partial || body.toleranceValue !== undefined) {
    payload.toleranceValue = parseNumber(body.toleranceValue, "허용 오차", 0);
  }

  if (!partial || body.unit !== undefined) {
    const unit = normalizeText(body.unit);
    assertNoUnsafeHtml(unit, "단위");
    payload.unit = unit;
  }

  if (!partial || body.judgementRule !== undefined) {
    payload.judgementRule = parseJudgementRule(body.judgementRule);
  }

  if (
    (!partial || body.standardValue !== undefined || body.measuredValue !== undefined || body.toleranceValue !== undefined || body.judgementRule !== undefined) &&
    (payload.standardValue !== undefined || payload.measuredValue !== undefined || payload.toleranceValue !== undefined || payload.judgementRule !== undefined)
  ) {
    const evaluation = computeQcTestReportEvaluation({
      standardValue: payload.standardValue ?? parseNumber(body.standardValue, "기준값"),
      measuredValue: payload.measuredValue ?? parseNumber(body.measuredValue, "실측값"),
      toleranceValue: payload.toleranceValue ?? parseNumber(body.toleranceValue, "허용 오차", 0),
      judgementRule: payload.judgementRule ?? parseJudgementRule(body.judgementRule),
    });
    payload.result = evaluation.result;
    payload.deviationValue = evaluation.deviationValue;
    payload.deviationRate = evaluation.deviationRate;
  }

  if (!partial || body.testingAgency !== undefined) {
    const testingAgency = normalizeText(body.testingAgency);
    assertNoUnsafeHtml(testingAgency, "시험 기관");
    payload.testingAgency = testingAgency;
  }

  if (!partial || body.certificateNo !== undefined) {
    const certificateNo = normalizeText(body.certificateNo);
    assertNoUnsafeHtml(certificateNo, "성적서 번호");
    payload.certificateNo = certificateNo;
  }

  if (!partial || body.versionNo !== undefined) {
    payload.versionNo = parsePositiveInt(body.versionNo, "버전", 1);
  }

  if (!partial || body.status !== undefined) {
    payload.status = parseStatus(body.status);
  }

  if (!partial || body.reviewerName !== undefined) {
    const reviewerName = normalizeText(body.reviewerName);
    assertNoUnsafeHtml(reviewerName, "검토자");
    payload.reviewerName = reviewerName;
  }

  if (!partial || body.reviewerMemberId !== undefined) {
    payload.reviewerMemberId = parseObjectId(body.reviewerMemberId, "검토자");
  }

  if (!partial || body.approverName !== undefined) {
    const approverName = normalizeText(body.approverName);
    assertNoUnsafeHtml(approverName, "승인자");
    payload.approverName = approverName;
  }

  if (!partial || body.approverMemberId !== undefined) {
    payload.approverMemberId = parseObjectId(body.approverMemberId, "승인자");
  }

  if (!partial || body.summary !== undefined) {
    const summary = normalizeText(body.summary);
    assertNoUnsafeHtml(summary, "시험 결과 메모");
    payload.summary = summary;
  }

  if (!partial || body.attachments !== undefined) {
    payload.attachments = parseAttachments(body.attachments);
  }

  if (!partial || body.ncrStatus !== undefined) {
    payload.ncrStatus = parseNcrStatus(body.ncrStatus);
  }

  if (!partial || body.ncrReference !== undefined) {
    const ncrReference = normalizeText(body.ncrReference);
    assertNoUnsafeHtml(ncrReference, "NCR 참조");
    payload.ncrReference = ncrReference;
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
    testType: payload.testType ?? "other",
    sourceType: payload.sourceType ?? "manual",
    sampleName: payload.sampleName ?? "",
    specimenNo: payload.specimenNo ?? "",
    samplingLocation: payload.samplingLocation ?? "",
    samplingDate: payload.samplingDate ?? null,
    testDate: payload.testDate ?? null,
    linkedMaterialInspectionId: payload.linkedMaterialInspectionId ?? "",
    linkedProcessInspectionId: payload.linkedProcessInspectionId ?? "",
    standardValue: payload.standardValue ?? 0,
    measuredValue: payload.measuredValue ?? 0,
    toleranceValue: payload.toleranceValue ?? 0,
    unit: payload.unit ?? "",
    judgementRule: payload.judgementRule ?? "minimum",
    result: payload.result ?? "pending",
    deviationValue: payload.deviationValue ?? 0,
    deviationRate: payload.deviationRate ?? 0,
    testingAgency: payload.testingAgency ?? "",
    certificateNo: payload.certificateNo ?? "",
    versionNo: payload.versionNo ?? 1,
    status: payload.status ?? "draft",
    reviewerName: payload.reviewerName ?? "",
    reviewerMemberId: payload.reviewerMemberId ?? "",
    approverName: payload.approverName ?? "",
    approverMemberId: payload.approverMemberId ?? "",
    summary: payload.summary ?? "",
    attachments: payload.attachments ?? [],
    ncrStatus: payload.ncrStatus ?? "none",
    ncrReference: payload.ncrReference ?? "",
    historyNote: payload.historyNote ?? "",
  };
}

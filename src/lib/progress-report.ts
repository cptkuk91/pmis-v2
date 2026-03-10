import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import type { ReportType } from "@/models/Report";
import type { Status } from "@/types";

export type NormalizedReportAttachment = {
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  sortOrder: number;
};

export type NormalizedReportPayload = {
  title: string;
  reportType: ReportType;
  reportDate: Date;
  authorName: string;
  content: string;
  progressRate: number;
  attachments: NormalizedReportAttachment[];
  status: Status;
};

type NormalizeOptions = {
  defaultReportType?: ReportType;
  defaultStatus?: Status;
  defaultAuthorName?: string;
};

export function isProgressReportType(value: string): value is ReportType {
  return value === "supervision" || value === "daily" || value === "weekly";
}

export function isProgressReportStatus(value: string): value is Status {
  return (
    value === "draft" ||
    value === "in_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "completed"
  );
}

export function normalizeProgressReportPayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
): NormalizedReportPayload {
  const title = String(body.title ?? "").trim();
  if (!title) {
    throw VALIDATION_ERROR("제목은 필수입니다.");
  }

  const reportTypeInput = String(body.reportType ?? options.defaultReportType ?? "weekly").trim();
  if (!isProgressReportType(reportTypeInput)) {
    throw VALIDATION_ERROR("유형 값이 올바르지 않습니다.");
  }

  const statusInput = String(body.status ?? options.defaultStatus ?? "draft").trim();
  if (!isProgressReportStatus(statusInput)) {
    throw VALIDATION_ERROR("상태 값이 올바르지 않습니다.");
  }

  const reportDate = body.reportDate ? new Date(String(body.reportDate)) : new Date();
  if (Number.isNaN(reportDate.getTime())) {
    throw VALIDATION_ERROR("보고일 형식이 올바르지 않습니다.");
  }

  const progressRateValue = Number(body.progressRate ?? 0);
  const progressRate = Number.isFinite(progressRateValue)
    ? Math.max(0, Math.min(100, progressRateValue))
    : 0;

  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const normalizedAttachments = attachments
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => ({
      fileAssetId: String(row.fileAssetId ?? "").trim(),
      fileName: String(row.fileName ?? "").trim(),
      sortOrder: Number(row.sortOrder ?? index),
    }))
    .filter((row) => row.fileAssetId && mongoose.Types.ObjectId.isValid(row.fileAssetId))
    .map((row, index) => ({
      fileAssetId: new mongoose.Types.ObjectId(row.fileAssetId),
      fileName: row.fileName || row.fileAssetId,
      sortOrder: Number.isFinite(row.sortOrder) ? Math.floor(row.sortOrder) : index,
    }));

  return {
    title,
    reportType: reportTypeInput,
    reportDate,
    authorName: String(body.authorName ?? options.defaultAuthorName ?? "현장관리자").trim() || "현장관리자",
    content: String(body.content ?? "").trim(),
    progressRate,
    attachments: normalizedAttachments,
    status: statusInput,
  };
}

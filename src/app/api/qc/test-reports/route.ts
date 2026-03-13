import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { getFileAssetLinkMap } from "@/lib/file-asset-links";
import {
  getQcTestReportSort,
  isQcTestReportResult,
  isQcTestReportSort,
  isQcTestReportSourceType,
  isQcTestReportStatus,
} from "@/lib/qc-test-reports";
import { normalizeQcTestReportPayload } from "@/lib/qc-test-report-payload";
import { resolveQcTestReportReferences } from "@/lib/qc-test-report-record";
import QcTestReport from "@/models/QcTestReport";

type QcTestReportLean = {
  _id: unknown;
  siteId: unknown;
  testType?: string;
  sourceType?: string;
  sampleName?: string;
  specimenNo?: string;
  samplingLocation?: string;
  samplingDate?: Date | null;
  testDate?: Date | null;
  linkedMaterialInspectionId?: mongoose.Types.ObjectId | null;
  linkedMaterialInspectionTitle?: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId | null;
  linkedProcessInspectionTitle?: string;
  standardValue?: number;
  measuredValue?: number;
  toleranceValue?: number;
  unit?: string;
  judgementRule?: string;
  result?: string;
  deviationValue?: number;
  deviationRate?: number;
  testingAgency?: string;
  certificateNo?: string;
  versionNo?: number;
  status?: string;
  reporterName?: string;
  reviewerName?: string;
  reviewerMemberId?: string;
  approverName?: string;
  approverMemberId?: string;
  summary?: string;
  attachments?: Array<{
    fileAssetId?: mongoose.Types.ObjectId | null;
    fileName?: string;
    category?: string;
    sortOrder?: number;
  }>;
  ncrStatus?: string;
  ncrReference?: string;
  history?: Array<{
    actionType?: string;
    status?: string;
    result?: string;
    versionNo?: number;
    note?: string;
    actorName?: string;
    actionDate?: Date | null;
  }>;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapAttachments(
  item: QcTestReportLean,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return (item.attachments ?? [])
    .map((attachment) => {
      const fileAssetId = String(attachment.fileAssetId ?? "").trim();
      if (!fileAssetId) {
        return null;
      }
      const fileLink = fileAssetLinkMap.get(fileAssetId);
      return {
        fileAssetId,
        fileName: attachment.fileName ?? fileLink?.originalName ?? fileAssetId,
        fileUrl: fileLink?.url ?? "",
        category: attachment.category ?? "other",
        sortOrder: Number(attachment.sortOrder ?? 0),
      };
    })
    .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function serializeTestReport(
  item: QcTestReportLean,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return {
    ...item,
    _id: String(item._id),
    siteId: String(item.siteId ?? ""),
    linkedMaterialInspectionId: item.linkedMaterialInspectionId ? String(item.linkedMaterialInspectionId) : "",
    linkedProcessInspectionId: item.linkedProcessInspectionId ? String(item.linkedProcessInspectionId) : "",
    attachments: mapAttachments(item, fileAssetLinkMap),
    history: (item.history ?? []).map((entry) => ({
      actionType: entry.actionType ?? "updated",
      status: entry.status ?? "draft",
      result: entry.result ?? "pending",
      versionNo: Number(entry.versionNo ?? 1),
      note: entry.note ?? "",
      actorName: entry.actorName ?? "",
      actionDate: entry.actionDate ? new Date(entry.actionDate).toISOString() : new Date(0).toISOString(),
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId") || (await resolveSiteId(request));
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 20);
    const skip = (page - 1) * limit;
    const keyword = String(searchParams.get("q") ?? "").trim();
    const status = String(searchParams.get("status") ?? "").trim();
    const result = String(searchParams.get("result") ?? "").trim();
    const sourceType = String(searchParams.get("sourceType") ?? "").trim();
    const sortRaw = String(searchParams.get("sort") ?? "test_date_desc").trim();
    const filter: Record<string, unknown> = { siteId };

    if (status) {
      if (!isQcTestReportStatus(status)) {
        throw VALIDATION_ERROR("시험 성적서 상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }

    if (result) {
      if (!isQcTestReportResult(result)) {
        throw VALIDATION_ERROR("시험 성적서 판정 필터 값이 올바르지 않습니다.");
      }
      filter.result = result;
    }

    if (sourceType) {
      if (!isQcTestReportSourceType(sourceType)) {
        throw VALIDATION_ERROR("시험 성적서 출처 필터 값이 올바르지 않습니다.");
      }
      filter.sourceType = sourceType;
    }

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { sampleName: regex },
        { specimenNo: regex },
        { samplingLocation: regex },
        { linkedMaterialInspectionTitle: regex },
        { linkedProcessInspectionTitle: regex },
        { testingAgency: regex },
        { certificateNo: regex },
        { summary: regex },
        { ncrReference: regex },
      ];
    }

    const sort = isQcTestReportSort(sortRaw) ? sortRaw : "test_date_desc";

    const [data, total] = await Promise.all([
      QcTestReport.find(filter)
        .sort(getQcTestReportSort(sort))
        .skip(skip)
        .limit(limit)
        .lean<Array<QcTestReportLean>>(),
      QcTestReport.countDocuments(filter),
    ]);

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      data.flatMap((item) => (item.attachments ?? []).map((attachment) => attachment.fileAssetId)),
    );

    return paginated(
      data.map((item) => serializeTestReport(item, fileAssetLinkMap)),
      page,
      limit,
      total,
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const body = (await request.json()) as Record<string, unknown>;
    const siteId = (await resolveSiteId(request)) || String(body.siteId ?? "");
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const payload = normalizeQcTestReportPayload(body);
    const referenceInfo = await resolveQcTestReportReferences(siteId, payload);
    const attachments = payload.attachments.map((attachment) => ({
      fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
      fileName: attachment.fileName,
      category: attachment.category,
      sortOrder: attachment.sortOrder,
    }));
    const ncrStatus = payload.ncrStatus === "none" && payload.result === "fail" ? "recommended" : payload.ncrStatus;

    const doc = await QcTestReport.create({
      siteId,
      testType: payload.testType,
      sourceType: payload.sourceType,
      sampleName: payload.sampleName,
      specimenNo: payload.specimenNo,
      samplingLocation: payload.samplingLocation,
      samplingDate: payload.samplingDate ?? new Date(),
      testDate: payload.testDate ?? new Date(),
      linkedMaterialInspectionId: referenceInfo.linkedMaterialInspectionId,
      linkedMaterialInspectionTitle: referenceInfo.linkedMaterialInspectionTitle,
      linkedProcessInspectionId: referenceInfo.linkedProcessInspectionId,
      linkedProcessInspectionTitle: referenceInfo.linkedProcessInspectionTitle,
      standardValue: payload.standardValue,
      measuredValue: payload.measuredValue,
      toleranceValue: payload.toleranceValue,
      unit: payload.unit,
      judgementRule: payload.judgementRule,
      result: payload.result,
      deviationValue: payload.deviationValue,
      deviationRate: payload.deviationRate,
      testingAgency: payload.testingAgency,
      certificateNo: payload.certificateNo,
      versionNo: payload.versionNo,
      status: payload.status,
      reporterName: requester.userName,
      reviewerName: payload.reviewerName,
      reviewerMemberId: payload.reviewerMemberId,
      approverName: payload.approverName,
      approverMemberId: payload.approverMemberId,
      summary: payload.summary,
      attachments,
      ncrStatus,
      ncrReference: payload.ncrReference,
      history: [
        {
          actionType: "created",
          status: payload.status,
          result: payload.result,
          versionNo: payload.versionNo,
          note: payload.historyNote || payload.summary,
          actorName: requester.userName,
          actionDate: new Date(),
        },
      ],
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qc_test_report", String(doc._id), requester, {
      testType: payload.testType,
      status: payload.status,
      result: payload.result,
      versionNo: payload.versionNo,
      ncrStatus,
      attachmentCount: attachments.length,
    });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { getFileAssetLinkMap } from "@/lib/file-asset-links";
import { normalizeQcTestReportPayload } from "@/lib/qc-test-report-payload";
import { inferQcTestReportHistoryAction, resolveQcTestReportReferences } from "@/lib/qc-test-report-record";
import QcTestReport from "@/models/QcTestReport";

type Params = {
  params: Promise<{ reportId: string }>;
};

async function findReport(siteId: string, reportId: string) {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    throw VALIDATION_ERROR("reportId 형식이 올바르지 않습니다.");
  }

  const item = await QcTestReport.findOne({ _id: reportId, siteId });
  if (!item) {
    throw NOT_FOUND("시험 성적서");
  }
  return item;
}

function mapAttachments(
  item: Awaited<ReturnType<typeof findReport>>,
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

function serializeReport(
  item: Awaited<ReturnType<typeof findReport>>,
  fileAssetLinkMap: Awaited<ReturnType<typeof getFileAssetLinkMap>>,
) {
  return {
    ...item.toObject(),
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

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { reportId } = await params;
    const item = await findReport(siteId, reportId);
    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );

    return success(serializeReport(item, fileAssetLinkMap));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { reportId } = await params;
    const item = await findReport(siteId, reportId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQcTestReportPayload(body, { partial: true });
    const previousState = {
      status: item.status,
      result: item.result,
      versionNo: item.versionNo,
    } as const;

    if (payload.testType !== undefined) item.testType = payload.testType;
    if (payload.sourceType !== undefined) item.sourceType = payload.sourceType;
    if (payload.sampleName !== undefined) item.sampleName = payload.sampleName;
    if (payload.specimenNo !== undefined) item.specimenNo = payload.specimenNo;
    if (payload.samplingLocation !== undefined) item.samplingLocation = payload.samplingLocation;
    if (payload.samplingDate !== undefined) item.samplingDate = payload.samplingDate ?? item.samplingDate;
    if (payload.testDate !== undefined) item.testDate = payload.testDate ?? item.testDate;

    if (
      payload.linkedMaterialInspectionId !== undefined ||
      payload.linkedProcessInspectionId !== undefined
    ) {
      const referenceInfo = await resolveQcTestReportReferences(siteId, {
        linkedMaterialInspectionId:
          payload.linkedMaterialInspectionId ??
          (item.linkedMaterialInspectionId ? String(item.linkedMaterialInspectionId) : ""),
        linkedProcessInspectionId:
          payload.linkedProcessInspectionId ??
          (item.linkedProcessInspectionId ? String(item.linkedProcessInspectionId) : ""),
      });
      item.linkedMaterialInspectionId = referenceInfo.linkedMaterialInspectionId;
      item.linkedMaterialInspectionTitle = referenceInfo.linkedMaterialInspectionTitle;
      item.linkedProcessInspectionId = referenceInfo.linkedProcessInspectionId;
      item.linkedProcessInspectionTitle = referenceInfo.linkedProcessInspectionTitle;
    }

    if (payload.standardValue !== undefined) item.standardValue = payload.standardValue;
    if (payload.measuredValue !== undefined) item.measuredValue = payload.measuredValue;
    if (payload.toleranceValue !== undefined) item.toleranceValue = payload.toleranceValue;
    if (payload.unit !== undefined) item.unit = payload.unit;
    if (payload.judgementRule !== undefined) item.judgementRule = payload.judgementRule;
    if (payload.result !== undefined) item.result = payload.result;
    if (payload.deviationValue !== undefined) item.deviationValue = payload.deviationValue;
    if (payload.deviationRate !== undefined) item.deviationRate = payload.deviationRate;
    if (payload.testingAgency !== undefined) item.testingAgency = payload.testingAgency;
    if (payload.certificateNo !== undefined) item.certificateNo = payload.certificateNo;
    if (payload.versionNo !== undefined) item.versionNo = payload.versionNo;
    if (payload.status !== undefined) item.status = payload.status;
    if (payload.reviewerName !== undefined) item.reviewerName = payload.reviewerName;
    if (payload.reviewerMemberId !== undefined) item.reviewerMemberId = payload.reviewerMemberId;
    if (payload.approverName !== undefined) item.approverName = payload.approverName;
    if (payload.approverMemberId !== undefined) item.approverMemberId = payload.approverMemberId;
    if (payload.summary !== undefined) item.summary = payload.summary;
    if (payload.attachments !== undefined) {
      item.attachments = payload.attachments.map((attachment) => ({
        fileAssetId: new mongoose.Types.ObjectId(attachment.fileAssetId),
        fileName: attachment.fileName,
        category: attachment.category,
        sortOrder: attachment.sortOrder,
      }));
    }
    if (payload.ncrStatus !== undefined) item.ncrStatus = payload.ncrStatus;
    if (payload.ncrReference !== undefined) item.ncrReference = payload.ncrReference;

    if (item.ncrStatus === "none" && item.result === "fail") {
      item.ncrStatus = "recommended";
    }

    const nextState = {
      status: item.status,
      result: item.result,
      versionNo: item.versionNo,
    } as const;
    item.history.push({
      actionType: inferQcTestReportHistoryAction(previousState, nextState),
      status: item.status,
      result: item.result,
      versionNo: item.versionNo,
      note: payload.historyNote || payload.summary || "",
      actorName: requester.userName,
      actionDate: new Date(),
    });

    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.save();

    logUpdate(siteId, "qc_test_report", reportId, requester, {
      updatedFields: Object.keys(body),
      status: item.status,
      result: item.result,
      versionNo: item.versionNo,
      ncrStatus: item.ncrStatus,
    });

    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      (item.attachments ?? []).map((attachment) => attachment.fileAssetId),
    );

    return success(serializeReport(item, fileAssetLinkMap));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { reportId } = await params;
    const item = await findReport(siteId, reportId);
    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.softDelete();

    logDelete(siteId, "qc_test_report", reportId, requester);
    return success({ id: reportId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

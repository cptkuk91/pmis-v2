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
import { normalizeQaProcedurePayload } from "@/lib/qa-procedure-payload";
import QaProcedure from "@/models/QaProcedure";

type Params = {
  params: Promise<{ procedureId: string }>;
};

async function resolveProcedure(request: NextRequest, procedureId: string) {
  const siteId = await resolveSiteId(request);
  if (!siteId) {
    throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
  }

  if (!mongoose.Types.ObjectId.isValid(procedureId)) {
    throw VALIDATION_ERROR("procedureId 형식이 올바르지 않습니다.");
  }

  const procedure = await QaProcedure.findOne({ _id: procedureId, siteId });
  if (!procedure) {
    throw NOT_FOUND("표준 절차·템플릿");
  }

  return { siteId, procedure };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { procedureId } = await params;
    const { siteId, procedure } = await resolveProcedure(request, procedureId);
    const fileAssetLinkMap = await getFileAssetLinkMap(siteId, [procedure.fileAssetId]);
    const fileUrl = procedure.fileAssetId ? fileAssetLinkMap.get(String(procedure.fileAssetId))?.url ?? "" : "";

    return success({
      ...procedure.toObject(),
      fileUrl,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { procedureId } = await params;
    const { siteId, procedure } = await resolveProcedure(request, procedureId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQaProcedurePayload(body);

    procedure.documentKey = payload.documentKey;
    procedure.categoryCode = payload.categoryCode;
    procedure.documentType = payload.documentType;
    procedure.title = payload.title;
    procedure.summary = payload.summary;
    procedure.scopeType = payload.scopeType;
    procedure.scopeSummary = payload.scopeSummary;
    procedure.versionNo = payload.versionNo;
    procedure.effectiveDate = payload.effectiveDate;
    procedure.status = payload.status;
    procedure.retiredAt = payload.retiredAt;
    procedure.isSiteRequired = payload.isSiteRequired;
    procedure.referenceTargets = payload.referenceTargets;
    procedure.externalDocUrl = payload.externalDocUrl;
    procedure.fileAssetId = payload.fileAssetId
      ? new mongoose.Types.ObjectId(payload.fileAssetId)
      : null;
    procedure.fileName = payload.fileName;
    procedure.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await procedure.save();

    logUpdate(siteId, "qa_procedure", procedureId, requester, {
      documentKey: payload.documentKey,
      categoryCode: payload.categoryCode,
      versionNo: payload.versionNo,
      status: payload.status,
    });

    return success(procedure);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { procedureId } = await params;
    const { siteId, procedure } = await resolveProcedure(request, procedureId);
    procedure.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await procedure.softDelete();
    logDelete(siteId, "qa_procedure", procedureId, requester);
    return success({ id: procedureId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

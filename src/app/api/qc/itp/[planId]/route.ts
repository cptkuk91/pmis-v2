import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeQcItpPayload } from "@/lib/qc-itp-payload";
import QcInspectionTestPlan from "@/models/QcInspectionTestPlan";

type Params = {
  params: Promise<{ planId: string }>;
};

async function resolvePlan(request: NextRequest, planId: string) {
  const siteId = await resolveSiteId(request);
  if (!siteId) {
    throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
  }

  if (!mongoose.Types.ObjectId.isValid(planId)) {
    throw VALIDATION_ERROR("planId 형식이 올바르지 않습니다.");
  }

  const plan = await QcInspectionTestPlan.findOne({ _id: planId, siteId });
  if (!plan) {
    throw NOT_FOUND("ITP");
  }

  return { siteId, plan };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { planId } = await params;
    const { plan } = await resolvePlan(request, planId);
    return success(plan);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { planId } = await params;
    const { siteId, plan } = await resolvePlan(request, planId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQcItpPayload(body);

    plan.year = payload.year;
    plan.versionNo = payload.versionNo;
    plan.status = payload.status;
    plan.planTitle = payload.planTitle;
    plan.workType = payload.workType;
    plan.processStep = payload.processStep;
    plan.scopeSummary = payload.scopeSummary;
    plan.revisionReason = payload.revisionReason;
    plan.referenceDrawingNo = payload.referenceDrawingNo;
    plan.referenceSpec = payload.referenceSpec;
    plan.notes = payload.notes;
    plan.checkpoints = payload.checkpoints;
    plan.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await plan.save();

    logUpdate(siteId, "qc_itp", planId, requester, {
      year: payload.year,
      versionNo: payload.versionNo,
      status: payload.status,
      workType: payload.workType,
      checkpointCount: payload.checkpoints.length,
    });

    return success(plan);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { planId } = await params;
    const { siteId, plan } = await resolvePlan(request, planId);
    plan.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await plan.softDelete();
    logDelete(siteId, "qc_itp", planId, requester);

    return success({ id: planId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeQaAssurancePlanPayload } from "@/lib/qa-assurance-plan-payload";
import QaAssurancePlan from "@/models/QaAssurancePlan";

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

  const plan = await QaAssurancePlan.findOne({ _id: planId, siteId });
  if (!plan) {
    throw NOT_FOUND("품질보증계획");
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
    const payload = normalizeQaAssurancePlanPayload(body);

    plan.year = payload.year;
    plan.versionNo = payload.versionNo;
    plan.status = payload.status;
    plan.planTitle = payload.planTitle;
    plan.revisionReason = payload.revisionReason;
    plan.linkedPolicyGoalId = payload.linkedPolicyGoalId;
    plan.linkedPolicyGoalTitle = payload.linkedPolicyGoalTitle;
    plan.linkedPolicyGoalYear = payload.linkedPolicyGoalYear;
    plan.linkedPolicyGoalRevisionNo = payload.linkedPolicyGoalRevisionNo;
    plan.scopeSummary = payload.scopeSummary;
    plan.qualityObjectiveSummary = payload.qualityObjectiveSummary;
    plan.templateReference = payload.templateReference;
    plan.checkpoints = payload.checkpoints;
    plan.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await plan.save();

    logUpdate(siteId, "qa_assurance_plan", planId, requester, {
      year: payload.year,
      versionNo: payload.versionNo,
      status: payload.status,
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
    logDelete(siteId, "qa_assurance_plan", planId, requester);

    return success({ id: planId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

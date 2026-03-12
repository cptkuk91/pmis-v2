import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeQaPolicyGoalPayload } from "@/lib/qa-policy-goal-payload";
import QaPolicyGoal from "@/models/QaPolicyGoal";

type Params = {
  params: Promise<{ policyGoalId: string }>;
};

async function resolvePolicyGoal(request: NextRequest, policyGoalId: string) {
  const siteId = await resolveSiteId(request);
  if (!siteId) {
    throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
  }

  if (!mongoose.Types.ObjectId.isValid(policyGoalId)) {
    throw VALIDATION_ERROR("policyGoalId 형식이 올바르지 않습니다.");
  }

  const policyGoal = await QaPolicyGoal.findOne({ _id: policyGoalId, siteId });
  if (!policyGoal) {
    throw NOT_FOUND("품질 정책·목표");
  }

  return { siteId, policyGoal };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { policyGoalId } = await params;
    const { policyGoal } = await resolvePolicyGoal(request, policyGoalId);
    return success(policyGoal);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { policyGoalId } = await params;
    const { siteId, policyGoal } = await resolvePolicyGoal(request, policyGoalId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQaPolicyGoalPayload(body);

    policyGoal.year = payload.year;
    policyGoal.status = payload.status;
    policyGoal.policyTitle = payload.policyTitle;
    policyGoal.policyStatement = payload.policyStatement;
    policyGoal.effectiveDate = payload.effectiveDate;
    policyGoal.revisionNo = payload.revisionNo;
    policyGoal.goals = payload.goals;
    policyGoal.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await policyGoal.save();

    logUpdate(siteId, "qa_policy_goal", policyGoalId, requester, {
      year: payload.year,
      status: payload.status,
      goalCount: payload.goals.length,
    });

    return success(policyGoal);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { policyGoalId } = await params;
    const { siteId, policyGoal } = await resolvePolicyGoal(request, policyGoalId);
    policyGoal.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await policyGoal.softDelete();
    logDelete(siteId, "qa_policy_goal", policyGoalId, requester);

    return success({ id: policyGoalId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

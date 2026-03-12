import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeQaKpiDefinitionPayload } from "@/lib/qa-kpi-payload";
import QaKpiDefinition from "@/models/QaKpiDefinition";

type Params = {
  params: Promise<{ definitionId: string }>;
};

async function resolveDefinition(request: NextRequest, definitionId: string) {
  const siteId = await resolveSiteId(request);
  if (!siteId) {
    throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
  }

  if (!mongoose.Types.ObjectId.isValid(definitionId)) {
    throw VALIDATION_ERROR("definitionId 형식이 올바르지 않습니다.");
  }

  const definition = await QaKpiDefinition.findOne({ _id: definitionId, siteId });
  if (!definition) {
    throw NOT_FOUND("품질 KPI");
  }

  return { siteId, definition };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { definitionId } = await params;
    const { definition } = await resolveDefinition(request, definitionId);
    return success(definition);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { definitionId } = await params;
    const { siteId, definition } = await resolveDefinition(request, definitionId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQaKpiDefinitionPayload(body);

    const duplicated = await QaKpiDefinition.exists({
      siteId,
      metricCode: payload.metricCode,
      _id: { $ne: definitionId },
    });
    if (duplicated) {
      throw VALIDATION_ERROR("같은 KPI 코드가 이미 등록되어 있습니다.");
    }

    definition.metricCode = payload.metricCode;
    definition.metricName = payload.metricName;
    definition.sourceMetric = payload.sourceMetric;
    definition.measurementCycle = payload.measurementCycle;
    definition.unit = payload.unit;
    definition.targetDirection = payload.targetDirection;
    definition.targetValue = payload.targetValue;
    definition.warningThreshold = payload.warningThreshold;
    definition.linkedPolicyGoalId = payload.linkedPolicyGoalId;
    definition.linkedPolicyGoalYear = payload.linkedPolicyGoalYear;
    definition.linkedPolicyGoalTitle = payload.linkedPolicyGoalTitle;
    definition.linkedPolicyGoalGoalId = payload.linkedPolicyGoalGoalId;
    definition.linkedPolicyGoalMetricName = payload.linkedPolicyGoalMetricName;
    definition.ownerName = payload.ownerName;
    definition.ownerMemberId = payload.ownerMemberId;
    definition.description = payload.description;
    definition.isActive = payload.isActive;
    definition.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await definition.save();

    logUpdate(siteId, "qa_kpi_definition", definitionId, requester, {
      metricCode: payload.metricCode,
      sourceMetric: payload.sourceMetric,
      measurementCycle: payload.measurementCycle,
      isActive: payload.isActive,
    });

    return success(definition);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { definitionId } = await params;
    const { siteId, definition } = await resolveDefinition(request, definitionId);
    definition.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await definition.softDelete();
    logDelete(siteId, "qa_kpi_definition", definitionId, requester);

    return success({ id: definitionId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

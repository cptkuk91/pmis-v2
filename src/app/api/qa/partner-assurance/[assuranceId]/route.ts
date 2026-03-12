import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeQaPartnerAssurancePayload } from "@/lib/qa-partner-assurance-payload";
import QaCapa from "@/models/QaCapa";
import QaPartnerAssurance from "@/models/QaPartnerAssurance";

type Params = {
  params: Promise<{ assuranceId: string }>;
};

async function assertLinkedCapa(siteId: string, capaId: string) {
  if (!capaId) {
    return;
  }

  const exists = await QaCapa.exists({ _id: capaId, siteId });
  if (!exists) {
    throw VALIDATION_ERROR("연결된 CAPA를 찾을 수 없습니다.");
  }
}

async function resolveAssurance(request: NextRequest, assuranceId: string) {
  const siteId = await resolveSiteId(request);
  if (!siteId) {
    throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
  }
  if (!mongoose.Types.ObjectId.isValid(assuranceId)) {
    throw VALIDATION_ERROR("assuranceId 형식이 올바르지 않습니다.");
  }

  const assurance = await QaPartnerAssurance.findOne({ _id: assuranceId, siteId });
  if (!assurance) {
    throw NOT_FOUND("협력사 품질보증 평가");
  }

  return { siteId, assurance };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { assuranceId } = await params;
    const { assurance } = await resolveAssurance(request, assuranceId);
    return success(assurance);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { assuranceId } = await params;
    const { siteId, assurance } = await resolveAssurance(request, assuranceId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQaPartnerAssurancePayload(body);
    await assertLinkedCapa(siteId, payload.linkedCapaId);

    assurance.partnerCode = payload.partnerCode;
    assurance.partnerName = payload.partnerName;
    assurance.partnerSource = payload.partnerSource;
    assurance.partnerCategory = payload.partnerCategory;
    assurance.evaluationType = payload.evaluationType;
    assurance.status = payload.status;
    assurance.evaluationDate = payload.evaluationDate;
    assurance.nextReviewDate = payload.nextReviewDate;
    assurance.evaluatorName = payload.evaluatorName;
    assurance.evaluatorMemberId = payload.evaluatorMemberId;
    assurance.contactName = payload.contactName;
    assurance.contactPhone = payload.contactPhone;
    assurance.scopeSummary = payload.scopeSummary;
    assurance.summary = payload.summary;
    assurance.improvementRequest = payload.improvementRequest;
    assurance.followUpStatus = payload.followUpStatus;
    assurance.linkedCapaId = payload.linkedCapaId;
    assurance.assessmentItems = payload.assessmentItems;
    assurance.totalScore = payload.totalScore;
    assurance.maxScore = payload.maxScore;
    assurance.grade = payload.grade;
    assurance.riskLevel = payload.riskLevel;
    assurance.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await assurance.save();

    logUpdate(siteId, "qa_partner_assurance", assuranceId, requester, {
      partnerName: payload.partnerName,
      grade: payload.grade,
      riskLevel: payload.riskLevel,
      followUpStatus: payload.followUpStatus,
    });

    return success(assurance);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { assuranceId } = await params;
    const { siteId, assurance } = await resolveAssurance(request, assuranceId);
    assurance.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await assurance.softDelete();

    logDelete(siteId, "qa_partner_assurance", assuranceId, requester);

    return success({ id: assuranceId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

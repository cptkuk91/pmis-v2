import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeQaAuditPayload } from "@/lib/qa-audit-payload";
import QaAudit from "@/models/QaAudit";

type Params = {
  params: Promise<{ auditId: string }>;
};

async function resolveAudit(request: NextRequest, auditId: string) {
  const siteId = await resolveSiteId(request);
  if (!siteId) {
    throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
  }
  if (!mongoose.Types.ObjectId.isValid(auditId)) {
    throw VALIDATION_ERROR("auditId 형식이 올바르지 않습니다.");
  }

  const audit = await QaAudit.findOne({ _id: auditId, siteId });
  if (!audit) {
    throw NOT_FOUND("내부 심사");
  }

  return { siteId, audit };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { auditId } = await params;
    const { audit } = await resolveAudit(request, auditId);
    return success(audit);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { auditId } = await params;
    const { siteId, audit } = await resolveAudit(request, auditId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQaAuditPayload(body);

    audit.auditTitle = payload.auditTitle;
    audit.auditType = payload.auditType;
    audit.status = payload.status;
    audit.plannedDate = payload.plannedDate;
    audit.actualDate = payload.actualDate;
    audit.auditeeName = payload.auditeeName;
    audit.scopeSummary = payload.scopeSummary;
    audit.auditLeadName = payload.auditLeadName;
    audit.auditLeadMemberId = payload.auditLeadMemberId;
    audit.linkedAssurancePlanId = payload.linkedAssurancePlanId;
    audit.linkedAssurancePlanTitle = payload.linkedAssurancePlanTitle;
    audit.linkedAssurancePlanYear = payload.linkedAssurancePlanYear;
    audit.linkedAssurancePlanVersionNo = payload.linkedAssurancePlanVersionNo;
    audit.referencedProcedures = payload.referencedProcedures;
    audit.checklistItems = payload.checklistItems;
    audit.resultSummary = payload.resultSummary;
    audit.nonconformityCount = payload.nonconformityCount;
    audit.observationCount = payload.observationCount;
    audit.capaRequestedCount = payload.capaRequestedCount;
    audit.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await audit.save();

    logUpdate(siteId, "qa_audit", auditId, requester, {
      auditType: payload.auditType,
      status: payload.status,
      nonconformityCount: payload.nonconformityCount,
      capaRequestedCount: payload.capaRequestedCount,
    });

    return success(audit);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { auditId } = await params;
    const { siteId, audit } = await resolveAudit(request, auditId);
    audit.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await audit.softDelete();
    logDelete(siteId, "qa_audit", auditId, requester);

    return success({ id: auditId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

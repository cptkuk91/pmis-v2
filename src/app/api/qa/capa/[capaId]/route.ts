import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import {
  linkQaCapaToAudit,
  resolveQaCapaAuditSource,
  unlinkQaCapaFromAudit,
} from "@/lib/qa-capa-audit-link";
import { normalizeQaCapaPayload } from "@/lib/qa-capa-payload";
import QaCapa from "@/models/QaCapa";

type Params = {
  params: Promise<{ capaId: string }>;
};

async function resolveCapa(request: NextRequest, capaId: string) {
  const siteId = await resolveSiteId(request);
  if (!siteId) {
    throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
  }
  if (!mongoose.Types.ObjectId.isValid(capaId)) {
    throw VALIDATION_ERROR("capaId 형식이 올바르지 않습니다.");
  }

  const capa = await QaCapa.findOne({ _id: capaId, siteId });
  if (!capa) {
    throw NOT_FOUND("CAPA");
  }

  return { siteId, capa };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const { capaId } = await params;
    const { capa } = await resolveCapa(request, capaId);
    return success(capa);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { capaId } = await params;
    const { siteId, capa } = await resolveCapa(request, capaId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQaCapaPayload(body, { previousStatus: capa.status });

    let sourceMeta = {
      sourceSummary: payload.sourceSummary,
      sourceAuditTitle: "",
      sourceChecklistSection: "",
      sourceChecklistTitle: "",
    };
    if (payload.sourceType === "audit") {
      sourceMeta = await resolveQaCapaAuditSource(siteId, payload.sourceAuditId, payload.sourceChecklistId, capaId);
    }

    const previousAuditLink =
      capa.sourceType === "audit" && capa.sourceAuditId && capa.sourceChecklistId
        ? {
            auditId: capa.sourceAuditId,
            checklistId: capa.sourceChecklistId,
          }
        : null;

    capa.title = payload.title;
    capa.sourceType = payload.sourceType;
    capa.sourceSummary = sourceMeta.sourceSummary;
    capa.sourceAuditId = payload.sourceType === "audit" ? payload.sourceAuditId : "";
    capa.sourceAuditTitle = payload.sourceType === "audit" ? sourceMeta.sourceAuditTitle : "";
    capa.sourceChecklistId = payload.sourceType === "audit" ? payload.sourceChecklistId : "";
    capa.sourceChecklistSection = payload.sourceType === "audit" ? sourceMeta.sourceChecklistSection : "";
    capa.sourceChecklistTitle = payload.sourceType === "audit" ? sourceMeta.sourceChecklistTitle : "";
    capa.actionType = payload.actionType;
    capa.priority = payload.priority;
    capa.status = payload.status;
    capa.rootCauseSummary = payload.rootCauseSummary;
    capa.whyAnalysis = payload.whyAnalysis;
    capa.actionPlan = payload.actionPlan;
    capa.executionNote = payload.executionNote;
    capa.assigneeName = payload.assigneeName;
    capa.assigneeMemberId = payload.assigneeMemberId;
    capa.verifierName = payload.verifierName;
    capa.verifierMemberId = payload.verifierMemberId;
    capa.dueDate = payload.dueDate;
    capa.verifiedAt = payload.verifiedAt;
    capa.verificationNote = payload.verificationNote;
    capa.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;

    await capa.save();

    const currentAuditLink =
      payload.sourceType === "audit"
        ? {
            auditId: payload.sourceAuditId,
            checklistId: payload.sourceChecklistId,
          }
        : null;

    if (
      previousAuditLink &&
      (!currentAuditLink ||
        previousAuditLink.auditId !== currentAuditLink.auditId ||
        previousAuditLink.checklistId !== currentAuditLink.checklistId)
    ) {
      await unlinkQaCapaFromAudit({
        siteId,
        auditId: previousAuditLink.auditId,
        checklistId: previousAuditLink.checklistId,
        capaId,
        updatedByUserId: requester.userId,
      });
    }

    if (currentAuditLink) {
      await linkQaCapaToAudit({
        siteId,
        auditId: currentAuditLink.auditId,
        checklistId: currentAuditLink.checklistId,
        capaId,
        updatedByUserId: requester.userId,
      });
    }

    logUpdate(siteId, "qa_capa", capaId, requester, {
      sourceType: payload.sourceType,
      actionType: payload.actionType,
      priority: payload.priority,
      status: payload.status,
    });

    return success(capa);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { capaId } = await params;
    const { siteId, capa } = await resolveCapa(request, capaId);
    const previousAuditLink =
      capa.sourceType === "audit" && capa.sourceAuditId && capa.sourceChecklistId
        ? {
            auditId: capa.sourceAuditId,
            checklistId: capa.sourceChecklistId,
          }
        : null;

    capa.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await capa.softDelete();

    if (previousAuditLink) {
      await unlinkQaCapaFromAudit({
        siteId,
        auditId: previousAuditLink.auditId,
        checklistId: previousAuditLink.checklistId,
        capaId,
        updatedByUserId: requester.userId,
      });
    }

    logDelete(siteId, "qa_capa", capaId, requester);

    return success({ id: capaId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

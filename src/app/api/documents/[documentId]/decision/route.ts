import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logStatusChange, logUpdate } from "@/lib/audit-logger";
import { summarizeDocumentApprovalLines } from "@/lib/document-approval";
import DocumentModel from "@/models/Document";
import DocumentApprovalLine from "@/models/DocumentApprovalLine";

type Params = {
  params: Promise<{ documentId: string }>;
};

type DecisionStatus = "approved" | "rejected";

function isDecisionStatus(value: string): value is DecisionStatus {
  return value === "approved" || value === "rejected";
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { documentId } = await params;
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw VALIDATION_ERROR("documentId 형식이 올바르지 않습니다.");
    }

    const document = await DocumentModel.findOne({ _id: documentId, siteId });
    if (!document) {
      throw NOT_FOUND("문서");
    }
    if (document.status !== "in_review") {
      throw new ApiError("결재 진행 중인 문서만 승인 또는 반려할 수 있습니다.", 409, "INVALID_STATUS");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const decision = String(body.decision ?? "").trim();
    if (!isDecisionStatus(decision)) {
      throw VALIDATION_ERROR("decision 값은 approved 또는 rejected만 가능합니다.");
    }

    const comment = String(body.comment ?? "").trim();
    if (comment) {
      assertNoUnsafeHtml(comment, "결재 의견");
    }
    if (decision === "rejected" && !comment) {
      throw VALIDATION_ERROR("반려 사유를 입력해 주세요.");
    }

    const approvalLines = await DocumentApprovalLine.find({ siteId, documentId }).sort({ order: 1 });
    const summary = summarizeDocumentApprovalLines(
      approvalLines.map((line) => ({
        _id: line._id,
        documentId: line.documentId,
        order: line.order,
        approverName: line.approverName,
        approverRoleTitle: line.approverRoleTitle,
        status: line.status,
        actedAt: line.actedAt ?? null,
        comment: line.comment ?? "",
      })),
    );

    const previousStatus = document.status;
    const updaterObjectId = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    const actedAt = new Date();

    if (summary.currentLine) {
      const currentLine = approvalLines.find((line) => line.order === summary.currentLine?.order);
      if (!currentLine) {
        throw new ApiError("현재 결재선을 확인할 수 없습니다.", 409, "APPROVAL_LINE_MISSING");
      }

      currentLine.status = decision;
      currentLine.actedAt = actedAt;
      currentLine.comment = comment;
      currentLine.updatedBy = updaterObjectId ?? undefined;
      await currentLine.save();
    }

    if (decision === "rejected") {
      document.status = "rejected";
      document.currentApprovalOrder = 0;
      document.finalApproverName = summary.currentLine?.approverName || requester.userName;
      document.completedAt = undefined;
    } else {
      const refreshedLines = await DocumentApprovalLine.find({ siteId, documentId }).sort({ order: 1 });
      const nextSummary = summarizeDocumentApprovalLines(
        refreshedLines.map((line) => ({
          _id: line._id,
          documentId: line.documentId,
          order: line.order,
          approverName: line.approverName,
          approverRoleTitle: line.approverRoleTitle,
          status: line.status,
          actedAt: line.actedAt ?? null,
          comment: line.comment ?? "",
        })),
      );

      if (nextSummary.currentLine) {
        document.status = "in_review";
        document.currentApprovalOrder = nextSummary.currentLine.order;
        document.finalApproverName =
          nextSummary.finalLine?.approverName ||
          document.finalApproverName ||
          nextSummary.currentLine.approverName;
      } else {
        document.status = "approved";
        document.currentApprovalOrder = 0;
        document.finalApproverName =
          summary.currentLine?.approverName ||
          nextSummary.finalLine?.approverName ||
          requester.userName;
        document.completedAt = actedAt;
      }
    }

    document.updatedBy = updaterObjectId ?? undefined;
    await document.save();

    if (previousStatus !== document.status) {
      logStatusChange(siteId, "document", documentId, requester, previousStatus, document.status);
    } else {
      logUpdate(siteId, "document", documentId, requester, {
        decision,
        currentApprovalOrder: document.currentApprovalOrder,
      });
    }

    return success({
      id: documentId,
      status: document.status,
      currentApprovalOrder: document.currentApprovalOrder,
      finalApproverName: document.finalApproverName,
      actedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import DocumentModel from "@/models/Document";
import DocumentAttachment from "@/models/DocumentAttachment";
import DocumentApprovalLine from "@/models/DocumentApprovalLine";
import type { Status } from "@/types";

type Params = {
  params: Promise<{ documentId: string }>;
};

type LedgerType = "instruction" | "outbound" | "inbound" | "general";
type Direction = "outbound" | "inbound" | "internal";

function isStatus(value: string): value is Status {
  return ["draft", "in_review", "approved", "rejected", "completed"].includes(value);
}

function isLedgerType(value: string): value is LedgerType {
  return ["instruction", "outbound", "inbound", "general"].includes(value);
}

function isDirection(value: string): value is Direction {
  return ["outbound", "inbound", "internal"].includes(value);
}

async function replaceAttachments(
  siteId: string,
  documentId: string,
  requesterUserId: string | null,
  attachments: unknown,
) {
  if (!Array.isArray(attachments)) {
    return;
  }

  const updaterObjectId = requesterUserId ? new mongoose.Types.ObjectId(requesterUserId) : undefined;
  await DocumentAttachment.updateMany(
    { siteId, documentId, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        ...(updaterObjectId ? { updatedBy: updaterObjectId } : {}),
      },
    },
  );

  const normalized = attachments
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => ({
      fileAssetId: String(row.fileAssetId ?? "").trim(),
      fileName: String(row.fileName ?? "").trim(),
      sortOrder: Number(row.sortOrder ?? index),
    }))
    .filter((row) => row.fileAssetId && mongoose.Types.ObjectId.isValid(row.fileAssetId));

  if (normalized.length > 0) {
    await DocumentAttachment.insertMany(
      normalized.map((row) => ({
        siteId,
        documentId,
        fileAssetId: row.fileAssetId,
        fileName: row.fileName || row.fileAssetId,
        sortOrder: Number.isFinite(row.sortOrder) ? Math.floor(row.sortOrder) : 0,
        createdBy: requesterUserId ?? undefined,
        updatedBy: requesterUserId ?? undefined,
      })),
    );
  }
}

async function replaceApprovalLines(
  siteId: string,
  documentId: string,
  requesterUserId: string | null,
  approvalLines: unknown,
) {
  if (!Array.isArray(approvalLines)) {
    return;
  }

  const updaterObjectId = requesterUserId ? new mongoose.Types.ObjectId(requesterUserId) : undefined;
  await DocumentApprovalLine.updateMany(
    { siteId, documentId, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        ...(updaterObjectId ? { updatedBy: updaterObjectId } : {}),
      },
    },
  );

  const normalized = approvalLines
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => ({
      order: Number(row.order ?? index + 1),
      approverId: String(row.approverId ?? "").trim(),
      approverName: String(row.approverName ?? "").trim(),
      approverRoleTitle: String(row.approverRoleTitle ?? "").trim(),
      status: String(row.status ?? "pending"),
      comment: String(row.comment ?? "").trim(),
    }))
    .filter((row) => row.approverName);

  if (normalized.length > 0) {
    await DocumentApprovalLine.insertMany(
      normalized.map((row) => ({
        siteId,
        documentId,
        order: Number.isFinite(row.order) ? Math.floor(row.order) : 1,
        approverId: row.approverId && mongoose.Types.ObjectId.isValid(row.approverId) ? row.approverId : undefined,
        approverName: row.approverName,
        approverRoleTitle: row.approverRoleTitle,
        status: row.status === "approved" || row.status === "rejected" ? row.status : "pending",
        comment: row.comment,
        createdBy: requesterUserId ?? undefined,
        updatedBy: requesterUserId ?? undefined,
      })),
    );
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { documentId } = await params;
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw VALIDATION_ERROR("documentId 형식이 올바르지 않습니다.");
    }

    const document = await DocumentModel.findOne({ _id: documentId, siteId }).lean();
    if (!document) {
      throw NOT_FOUND("문서");
    }

    const [attachments, approvalLines] = await Promise.all([
      DocumentAttachment.find({ siteId, documentId }).sort({ sortOrder: 1 }).lean(),
      DocumentApprovalLine.find({ siteId, documentId }).sort({ order: 1 }).lean(),
    ]);

    return success({ document, attachments, approvalLines });
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

    const { documentId } = await params;
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw VALIDATION_ERROR("documentId 형식이 올바르지 않습니다.");
    }

    const document = await DocumentModel.findOne({ _id: documentId, siteId });
    if (!document) {
      throw NOT_FOUND("문서");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextTitle = body.title === undefined ? undefined : String(body.title ?? "").trim();
    const nextStatus = body.status === undefined ? undefined : String(body.status ?? "").trim();
    const nextLedgerType = body.ledgerType === undefined ? undefined : String(body.ledgerType ?? "").trim();
    const nextDirection = body.direction === undefined ? undefined : String(body.direction ?? "").trim();

    if (nextTitle !== undefined && !nextTitle) {
      throw VALIDATION_ERROR("문서 제목은 비워둘 수 없습니다.");
    }
    if (nextTitle !== undefined) {
      assertNoUnsafeHtml(nextTitle, "문서 제목");
    }
    if (nextStatus !== undefined && !isStatus(nextStatus)) {
      throw VALIDATION_ERROR("status 값이 올바르지 않습니다.");
    }
    if (nextLedgerType !== undefined && !isLedgerType(nextLedgerType)) {
      throw VALIDATION_ERROR("ledgerType 값이 올바르지 않습니다.");
    }
    if (nextDirection !== undefined && !isDirection(nextDirection)) {
      throw VALIDATION_ERROR("direction 값이 올바르지 않습니다.");
    }

    if (body.docNo !== undefined) {
      const nextDocNo = String(body.docNo ?? "").trim();
      if (!nextDocNo) {
        throw VALIDATION_ERROR("docNo는 비워둘 수 없습니다.");
      }
      document.docNo = nextDocNo;
    }
    if (nextTitle !== undefined) {
      document.title = nextTitle;
    }
    if (body.content !== undefined) {
      const nextContent = String(body.content ?? "").trim();
      assertNoUnsafeHtml(nextContent, "문서 내용");
      document.content = nextContent;
    }
    if (nextLedgerType !== undefined) {
      document.ledgerType = nextLedgerType;
    }
    if (nextDirection !== undefined) {
      document.direction = nextDirection;
    }
    if (nextStatus !== undefined) {
      document.status = nextStatus;
    }
    if (body.categoryCode !== undefined) {
      document.categoryCode = String(body.categoryCode ?? "").trim().toUpperCase();
    }
    if (body.senderName !== undefined) {
      document.senderName = String(body.senderName ?? "").trim();
    }
    if (body.receiverName !== undefined) {
      document.receiverName = String(body.receiverName ?? "").trim();
    }
    if (body.draftByName !== undefined) {
      document.draftByName = String(body.draftByName ?? "").trim();
    }
    if (body.submittedAt !== undefined) {
      document.submittedAt = body.submittedAt ? new Date(String(body.submittedAt)) : undefined;
    }
    if (body.sentAt !== undefined) {
      document.sentAt = body.sentAt ? new Date(String(body.sentAt)) : undefined;
    }
    if (body.receivedAt !== undefined) {
      document.receivedAt = body.receivedAt ? new Date(String(body.receivedAt)) : undefined;
    }
    if (body.completedAt !== undefined) {
      document.completedAt = body.completedAt ? new Date(String(body.completedAt)) : undefined;
    }
    if (body.currentApprovalOrder !== undefined) {
      document.currentApprovalOrder = Number(body.currentApprovalOrder ?? 0);
    }
    if (body.finalApproverName !== undefined) {
      document.finalApproverName = String(body.finalApproverName ?? "").trim();
    }
    document.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await document.save();

    await Promise.all([
      replaceAttachments(siteId, documentId, requester.userId, body.attachments),
      replaceApprovalLines(siteId, documentId, requester.userId, body.approvalLines),
    ]);

    logUpdate(siteId, "document", documentId, requester, { updatedFields: Object.keys(body) });
    return success(document);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
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

    const updaterObjectId = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    document.updatedBy = updaterObjectId ?? undefined;
    await document.softDelete();

    await Promise.all([
      DocumentAttachment.updateMany(
        { siteId, documentId, isDeleted: false },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            ...(updaterObjectId ? { updatedBy: updaterObjectId } : {}),
          },
        },
      ),
      DocumentApprovalLine.updateMany(
        { siteId, documentId, isDeleted: false },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            ...(updaterObjectId ? { updatedBy: updaterObjectId } : {}),
          },
        },
      ),
    ]);

    logDelete(siteId, "document", documentId, requester);
    return success({ id: documentId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

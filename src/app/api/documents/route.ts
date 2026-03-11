import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { generateNextDocumentNo } from "@/lib/document-doc-no";
import { ensureAllowedDocumentCategory } from "@/lib/document-category-code";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import DocumentModel, { type IDocument } from "@/models/Document";
import DocumentAttachment from "@/models/DocumentAttachment";
import DocumentApprovalLine from "@/models/DocumentApprovalLine";
import type { Status } from "@/types";

type LedgerType = "instruction" | "outbound" | "inbound" | "general";
type Direction = "outbound" | "inbound" | "internal";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isStatus(value: string): value is Status {
  return ["draft", "in_review", "approved", "rejected", "completed"].includes(value);
}

function isLedgerType(value: string): value is LedgerType {
  return ["instruction", "outbound", "inbound", "general"].includes(value);
}

function isDirection(value: string): value is Direction {
  return ["outbound", "inbound", "internal"].includes(value);
}

function defaultDirectionForLedger(ledgerType: LedgerType): Direction {
  if (ledgerType === "outbound") {
    return "outbound";
  }
  if (ledgerType === "inbound") {
    return "inbound";
  }
  return "internal";
}

function isLedgerDirectionCompatible(ledgerType: LedgerType, direction: Direction): boolean {
  if (ledgerType === "outbound") {
    return direction === "outbound";
  }
  if (ledgerType === "inbound") {
    return direction === "inbound";
  }
  if (ledgerType === "instruction") {
    return direction === "internal";
  }
  return true;
}

function isDuplicateDocNoError(error: unknown): boolean {
  const duplicateKeyError = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };

  return duplicateKeyError?.code === 11000 && Boolean(duplicateKeyError?.keyPattern?.docNo);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const ledger = String(request.nextUrl.searchParams.get("ledger") ?? "all").trim();
    const direction = String(request.nextUrl.searchParams.get("direction") ?? "all").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const sort = request.nextUrl.searchParams.get("sort") ?? "latest";
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { docNo: regex },
        { title: regex },
        { content: regex },
        { senderName: regex },
        { receiverName: regex },
      ];
    }
    if (ledger !== "all" && isLedgerType(ledger)) {
      filter.ledgerType = ledger;
    }
    if (direction !== "all" && isDirection(direction)) {
      filter.direction = direction;
    }
    if (status !== "all" && isStatus(status)) {
      filter.status = status;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      latest: { updatedAt: -1, createdAt: -1 },
      oldest: { updatedAt: 1, createdAt: 1 },
      no_asc: { docNo: 1 },
      no_desc: { docNo: -1 },
      title_asc: { title: 1 },
      title_desc: { title: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.latest;

    const [items, total] = await Promise.all([
      DocumentModel.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      DocumentModel.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const requestedDocNo = String(body.docNo ?? "").trim();
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    if (!title) {
      throw VALIDATION_ERROR("문서 제목은 필수입니다.");
    }
    assertNoUnsafeHtml(title, "문서 제목");
    assertNoUnsafeHtml(content, "문서 내용");

    const ledgerInput = String(body.ledgerType ?? "general").trim();
    if (!isLedgerType(ledgerInput)) {
      throw VALIDATION_ERROR("ledgerType 값이 올바르지 않습니다.");
    }
    const ledgerType: LedgerType = ledgerInput;

    const hasDirectionInput = body.direction !== undefined;
    const directionInput = hasDirectionInput ? String(body.direction ?? "").trim() : "";
    if (hasDirectionInput && (!directionInput || !isDirection(directionInput))) {
      throw VALIDATION_ERROR("direction 값이 올바르지 않습니다.");
    }
    const direction: Direction = hasDirectionInput
      ? (directionInput as Direction)
      : defaultDirectionForLedger(ledgerType);

    if (!isLedgerDirectionCompatible(ledgerType, direction)) {
      throw VALIDATION_ERROR(
        "ledgerType과 direction 조합이 올바르지 않습니다. (instruction=internal, outbound=outbound, inbound=inbound)",
      );
    }
    const statusInput = String(body.status ?? "draft");
    const status: Status = isStatus(statusInput) ? statusInput : "draft";
    const categoryCode = String(body.categoryCode ?? "").trim().toUpperCase();
    await ensureAllowedDocumentCategory(siteId, categoryCode);

    let createdDocument: IDocument | null = null;
    let finalDocNo = requestedDocNo;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      finalDocNo = requestedDocNo || (await generateNextDocumentNo(siteId));

      try {
        createdDocument = await DocumentModel.create({
          siteId,
          docNo: finalDocNo,
          title,
          content,
          ledgerType,
          direction,
          status,
          categoryCode,
          senderName: String(body.senderName ?? requester.userName).trim(),
          receiverName: String(body.receiverName ?? "").trim(),
          draftByName: String(body.draftByName ?? requester.userName).trim(),
          submittedAt: status === "in_review" ? new Date() : undefined,
          sentAt: body.sentAt ? new Date(String(body.sentAt)) : undefined,
          receivedAt: body.receivedAt ? new Date(String(body.receivedAt)) : undefined,
          completedAt:
            status === "approved" || status === "completed"
              ? new Date()
              : undefined,
          currentApprovalOrder: Number(body.currentApprovalOrder ?? 0),
          finalApproverName: String(body.finalApproverName ?? "").trim(),
          createdBy: requester.userId ?? undefined,
          updatedBy: requester.userId ?? undefined,
        });
        break;
      } catch (error) {
        if (requestedDocNo || !isDuplicateDocNoError(error) || attempt === 4) {
          throw error;
        }
      }
    }

    if (!createdDocument) {
      throw new ApiError("문서번호 자동 생성에 실패했습니다.", 409, "DOC_NO_GENERATION_FAILED");
    }

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const normalizedAttachments = attachments
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((row, index) => ({
        fileAssetId: String(row.fileAssetId ?? "").trim(),
        fileName: String(row.fileName ?? "").trim(),
        sortOrder: Number(row.sortOrder ?? index),
      }))
      .filter((row) => row.fileAssetId && mongoose.Types.ObjectId.isValid(row.fileAssetId));

    if (normalizedAttachments.length > 0) {
      await DocumentAttachment.insertMany(
        normalizedAttachments.map((row) => ({
          siteId,
          documentId: createdDocument._id,
          fileAssetId: row.fileAssetId,
          fileName: row.fileName || row.fileAssetId,
          sortOrder: Number.isFinite(row.sortOrder) ? Math.floor(row.sortOrder) : 0,
          createdBy: requester.userId ?? undefined,
          updatedBy: requester.userId ?? undefined,
        })),
      );
    }

    const approvalLines = Array.isArray(body.approvalLines) ? body.approvalLines : [];
    const normalizedApprovalLines = approvalLines
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((row, index) => ({
        order: Number(row.order ?? index + 1),
        approverId: String(row.approverId ?? "").trim(),
        approverName: String(row.approverName ?? "").trim(),
        approverRoleTitle: String(row.approverRoleTitle ?? "").trim(),
      }))
      .filter((row) => row.approverName);

    if (normalizedApprovalLines.length > 0) {
      await DocumentApprovalLine.insertMany(
        normalizedApprovalLines.map((row) => ({
          siteId,
          documentId: createdDocument._id,
          order: Number.isFinite(row.order) ? Math.floor(row.order) : 1,
          approverId: row.approverId && mongoose.Types.ObjectId.isValid(row.approverId) ? row.approverId : undefined,
          approverName: row.approverName,
          approverRoleTitle: row.approverRoleTitle,
          status: "pending",
          createdBy: requester.userId ?? undefined,
          updatedBy: requester.userId ?? undefined,
        })),
      );
    }

    logCreate(siteId, "document", String(createdDocument._id), requester);
    return success(createdDocument);
  } catch (err) {
    return handleApiError(err);
  }
}

import DocumentModel from "@/models/Document";
import DocumentApprovalLine, { type ApprovalStatus } from "@/models/DocumentApprovalLine";

type ApprovalLineRecord = {
  _id: unknown;
  documentId: unknown;
  order: number;
  approverName: string;
  approverRoleTitle: string;
  status: ApprovalStatus;
  actedAt?: Date | string | null;
  comment?: string;
};

type ApprovalSummaryRecord = {
  totalSteps: number;
  approvedSteps: number;
  rejectedSteps: number;
  pendingSteps: number;
  currentLine: ApprovalLineRecord | null;
  finalLine: ApprovalLineRecord | null;
};

export type PendingDocumentSummary = {
  _id: string;
  docNo: string;
  title: string;
  status: "in_review";
  draftByName: string;
  submittedAt: Date | null;
  updatedAt: Date | null;
  currentApprovalOrder: number;
  totalApprovalSteps: number;
  currentApproverName: string;
  currentApproverRoleTitle: string;
  finalApproverName: string;
};

function toIdString(value: unknown): string {
  if (!value) {
    return "";
  }

  return String(value);
}

export function summarizeDocumentApprovalLines(
  lines: ApprovalLineRecord[],
): ApprovalSummaryRecord {
  const sortedLines = [...lines].sort((left, right) => left.order - right.order);
  const currentLine = sortedLines.find((line) => line.status === "pending") ?? null;
  const finalLine = sortedLines.at(-1) ?? null;

  return {
    totalSteps: sortedLines.length,
    approvedSteps: sortedLines.filter((line) => line.status === "approved").length,
    rejectedSteps: sortedLines.filter((line) => line.status === "rejected").length,
    pendingSteps: sortedLines.filter((line) => line.status === "pending").length,
    currentLine,
    finalLine,
  };
}

export async function listPendingDocuments(
  siteId: string,
  options: { limit?: number } = {},
): Promise<PendingDocumentSummary[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
  const documents = await DocumentModel.find({ siteId, status: "in_review" })
    .sort({ submittedAt: -1, updatedAt: -1, createdAt: -1 })
    .limit(limit)
    .select({
      docNo: 1,
      title: 1,
      status: 1,
      draftByName: 1,
      submittedAt: 1,
      updatedAt: 1,
      currentApprovalOrder: 1,
      finalApproverName: 1,
    })
    .lean<
      Array<{
        _id: unknown;
        docNo?: string;
        title?: string;
        status: "in_review";
        draftByName?: string;
        submittedAt?: Date | string | null;
        updatedAt?: Date | string | null;
        currentApprovalOrder?: number;
        finalApproverName?: string;
      }>
    >();

  if (documents.length === 0) {
    return [];
  }

  const documentIds = documents.map((document) => toIdString(document._id));
  const approvalLines = await DocumentApprovalLine.find({
    siteId,
    documentId: { $in: documentIds },
  })
    .sort({ order: 1 })
    .select({
      documentId: 1,
      order: 1,
      approverName: 1,
      approverRoleTitle: 1,
      status: 1,
      actedAt: 1,
      comment: 1,
    })
    .lean<ApprovalLineRecord[]>();

  const lineMap = new Map<string, ApprovalLineRecord[]>();
  for (const line of approvalLines) {
    const documentId = toIdString(line.documentId);
    const bucket = lineMap.get(documentId);
    if (bucket) {
      bucket.push(line);
      continue;
    }
    lineMap.set(documentId, [line]);
  }

  return documents.map((document) => {
    const documentId = toIdString(document._id);
    const summary = summarizeDocumentApprovalLines(lineMap.get(documentId) ?? []);
    const currentApproverName = summary.currentLine?.approverName ?? "";
    const currentApproverRoleTitle = summary.currentLine?.approverRoleTitle ?? "";
    const finalApproverName =
      document.finalApproverName?.trim() ||
      summary.finalLine?.approverName ||
      currentApproverName;

    return {
      _id: documentId,
      docNo: document.docNo ?? "",
      title: document.title ?? "",
      status: "in_review",
      draftByName: document.draftByName ?? "",
      submittedAt: document.submittedAt ? new Date(document.submittedAt) : null,
      updatedAt: document.updatedAt ? new Date(document.updatedAt) : null,
      currentApprovalOrder:
        summary.currentLine?.order ?? Math.max(0, Number(document.currentApprovalOrder ?? 0)),
      totalApprovalSteps: summary.totalSteps,
      currentApproverName,
      currentApproverRoleTitle,
      finalApproverName,
    };
  });
}

export async function countPendingDocuments(siteId: string): Promise<number> {
  return DocumentModel.countDocuments({ siteId, status: "in_review" });
}

import mongoose from "mongoose";
import { NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import type {
  QcHandoverApprovalStatus,
  QcHandoverHistoryAction,
  QcHandoverStatus,
} from "@/lib/qc-handover-inspections";
import QcNonconformance from "@/models/QcNonconformance";
import QcProcessInspection from "@/models/QcProcessInspection";

export type QcHandoverReferenceSnapshot = {
  linkedProcessInspectionId: string;
  linkedNcrId: string;
};

export async function resolveQcHandoverInspectionReferences(
  siteId: string,
  input: QcHandoverReferenceSnapshot,
) {
  const resolved = {
    linkedProcessInspectionId: undefined as mongoose.Types.ObjectId | undefined,
    linkedProcessInspectionTitle: "",
    linkedNcrId: undefined as mongoose.Types.ObjectId | undefined,
    linkedNcrNo: "",
    linkedNcrTitle: "",
  };

  if (input.linkedProcessInspectionId) {
    const inspection = await QcProcessInspection.findOne({
      _id: input.linkedProcessInspectionId,
      siteId,
    })
      .select({ inspectionTitle: 1, workType: 1, location: 1 })
      .lean<{ inspectionTitle?: string; workType?: string; location?: string } | null>();
    if (!inspection) {
      throw NOT_FOUND("연결 공정 검사");
    }
    resolved.linkedProcessInspectionId = new mongoose.Types.ObjectId(input.linkedProcessInspectionId);
    resolved.linkedProcessInspectionTitle = [
      inspection.inspectionTitle || "",
      inspection.workType || "",
      inspection.location || "",
    ]
      .filter(Boolean)
      .join(" / ");
  }

  if (input.linkedNcrId) {
    const ncr = await QcNonconformance.findOne({ _id: input.linkedNcrId, siteId })
      .select({ ncrNo: 1, title: 1 })
      .lean<{ ncrNo?: string; title?: string } | null>();
    if (!ncr) {
      throw NOT_FOUND("연결 NCR");
    }
    resolved.linkedNcrId = new mongoose.Types.ObjectId(input.linkedNcrId);
    resolved.linkedNcrNo = String(ncr.ncrNo ?? "");
    resolved.linkedNcrTitle = String(ncr.title ?? "");
  }

  return resolved;
}

export function inferQcHandoverHistoryAction(
  previousState: {
    status: QcHandoverStatus;
    approvalStatus: QcHandoverApprovalStatus;
    openFindingCount: number;
  },
  nextState: {
    status: QcHandoverStatus;
    approvalStatus: QcHandoverApprovalStatus;
    openFindingCount: number;
  },
): QcHandoverHistoryAction {
  if (nextState.status === "closed" && previousState.status !== "closed") {
    return "closed";
  }
  if (nextState.approvalStatus === "approved" && previousState.approvalStatus !== "approved") {
    return "approved";
  }
  if (nextState.approvalStatus === "requested" && previousState.approvalStatus !== "requested") {
    return "approval_requested";
  }
  if (nextState.openFindingCount < previousState.openFindingCount) {
    return "finding_completed";
  }
  if (nextState.openFindingCount > previousState.openFindingCount) {
    return "finding_requested";
  }
  if (nextState.status === "in_progress" && previousState.status !== "in_progress") {
    return "inspection_started";
  }
  return "updated";
}

export function assertValidQcHandoverLifecycle(input: {
  status: QcHandoverStatus;
  approvalStatus: QcHandoverApprovalStatus;
  openFindingCount: number;
  approvedAt?: Date | null;
}) {
  if (input.openFindingCount > 0 && (input.status === "approved" || input.status === "closed")) {
    throw VALIDATION_ERROR("미조치 지적사항이 남아 있으면 승인 또는 종결할 수 없습니다.");
  }

  if (input.status === "closed" && input.approvalStatus !== "approved") {
    throw VALIDATION_ERROR("종결 상태는 승인 완료 이후에만 설정할 수 있습니다.");
  }

  if (input.approvalStatus === "approved" && !input.approvedAt) {
    throw VALIDATION_ERROR("승인 완료 시 승인일이 필요합니다.");
  }
}

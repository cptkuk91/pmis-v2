import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import type {
  QcTestReportHistoryAction,
  QcTestReportResult,
  QcTestReportStatus,
} from "@/lib/qc-test-reports";
import MaterialInspection from "@/models/MaterialInspection";
import QcProcessInspection from "@/models/QcProcessInspection";

type QcTestReportReferenceInput = {
  linkedMaterialInspectionId?: string;
  linkedProcessInspectionId?: string;
};

type QcTestReportReferenceInfo = {
  linkedMaterialInspectionId?: mongoose.Types.ObjectId;
  linkedMaterialInspectionTitle: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId;
  linkedProcessInspectionTitle: string;
};

type QcTestReportLifecycleState = {
  status: QcTestReportStatus;
  result: QcTestReportResult;
  versionNo: number;
};

export async function resolveQcTestReportReferences(
  siteId: string,
  input: QcTestReportReferenceInput,
): Promise<QcTestReportReferenceInfo> {
  const linkedMaterialInspectionId = String(input.linkedMaterialInspectionId ?? "").trim();
  const linkedProcessInspectionId = String(input.linkedProcessInspectionId ?? "").trim();

  const [materialInspection, processInspection] = await Promise.all([
    linkedMaterialInspectionId
      ? MaterialInspection.findOne({ _id: linkedMaterialInspectionId, siteId })
          .select({ materialName: 1, specification: 1, inspectionDate: 1 })
          .lean()
      : null,
    linkedProcessInspectionId
      ? QcProcessInspection.findOne({ _id: linkedProcessInspectionId, siteId })
          .select({ inspectionTitle: 1, location: 1, plannedInspectionDate: 1 })
          .lean()
      : null,
  ]);

  if (linkedMaterialInspectionId && !materialInspection) {
    throw VALIDATION_ERROR("참조 자재 검사를 찾을 수 없습니다.");
  }
  if (linkedProcessInspectionId && !processInspection) {
    throw VALIDATION_ERROR("참조 공정 검사를 찾을 수 없습니다.");
  }

  return {
    linkedMaterialInspectionId: linkedMaterialInspectionId ? new mongoose.Types.ObjectId(linkedMaterialInspectionId) : undefined,
    linkedMaterialInspectionTitle: materialInspection
      ? `${materialInspection.materialName}${materialInspection.specification ? ` / ${materialInspection.specification}` : ""}`
      : "",
    linkedProcessInspectionId: linkedProcessInspectionId ? new mongoose.Types.ObjectId(linkedProcessInspectionId) : undefined,
    linkedProcessInspectionTitle: processInspection
      ? `${processInspection.inspectionTitle}${processInspection.location ? ` / ${processInspection.location}` : ""}`
      : "",
  };
}

export function inferQcTestReportHistoryAction(
  previous: QcTestReportLifecycleState,
  next: QcTestReportLifecycleState,
): QcTestReportHistoryAction {
  if (next.versionNo !== previous.versionNo) {
    return "version_updated";
  }
  if (previous.status !== "approved" && next.status === "approved") {
    return "approved";
  }
  if (previous.status !== "reviewed" && next.status === "reviewed") {
    return "reviewed";
  }
  if (previous.status !== "submitted" && next.status === "submitted") {
    return "submitted";
  }
  return "updated";
}

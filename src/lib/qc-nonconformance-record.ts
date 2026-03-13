import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import type {
  QcNonconformanceHistoryAction,
  QcNonconformanceSourceType,
  QcNonconformanceStatus,
  QcNonconformanceVerificationResult,
} from "@/lib/qc-nonconformance";
import QcNonconformance from "@/models/QcNonconformance";
import MaterialInspection from "@/models/MaterialInspection";
import QcProcessInspection from "@/models/QcProcessInspection";
import QcTestReport from "@/models/QcTestReport";

type ReferenceInput = {
  sourceType: QcNonconformanceSourceType;
  linkedMaterialInspectionId?: string;
  linkedProcessInspectionId?: string;
  linkedTestReportId?: string;
  sourceSummary?: string;
};

export type QcNonconformanceReferenceSnapshot = {
  linkedMaterialInspectionId: string;
  linkedProcessInspectionId: string;
  linkedTestReportId: string;
};

type LifecycleState = {
  status: QcNonconformanceStatus;
  verificationResult: QcNonconformanceVerificationResult;
};

export type QcNonconformanceReferenceInfo = {
  linkedMaterialInspectionId?: mongoose.Types.ObjectId;
  linkedMaterialInspectionTitle: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId;
  linkedProcessInspectionTitle: string;
  linkedTestReportId?: mongoose.Types.ObjectId;
  linkedTestReportTitle: string;
  sourceSummary: string;
};

function buildMaterialTitle(item: { materialName?: string; specification?: string }) {
  return `${String(item.materialName ?? "")}${item.specification ? ` / ${String(item.specification)}` : ""}`.trim();
}

function buildProcessTitle(item: { inspectionTitle?: string; location?: string }) {
  return `${String(item.inspectionTitle ?? "")}${item.location ? ` / ${String(item.location)}` : ""}`.trim();
}

function buildTestReportTitle(item: { sampleName?: string; certificateNo?: string }) {
  return `${String(item.sampleName ?? "")}${item.certificateNo ? ` / ${String(item.certificateNo)}` : ""}`.trim();
}

async function assertReferenceAvailable(
  siteId: string,
  input: {
    currentId?: string;
    fieldName: "linkedMaterialInspectionId" | "linkedProcessInspectionId" | "linkedTestReportId";
    referenceId: string;
    label: string;
  },
) {
  if (!input.referenceId) {
    return;
  }

  const duplicate = await QcNonconformance.findOne({
    siteId,
    [input.fieldName]: input.referenceId,
    ...(input.currentId ? { _id: { $ne: input.currentId } } : {}),
  })
    .select({ ncrNo: 1 })
    .lean<{ ncrNo?: string } | null>();

  if (duplicate?.ncrNo) {
    throw VALIDATION_ERROR(`${input.label}는 이미 ${duplicate.ncrNo}에 연결되어 있습니다.`);
  }
}

export async function resolveQcNonconformanceReferences(
  siteId: string,
  input: ReferenceInput,
  currentId?: string,
): Promise<QcNonconformanceReferenceInfo> {
  const linkedMaterialInspectionId = String(input.linkedMaterialInspectionId ?? "").trim();
  const linkedProcessInspectionId = String(input.linkedProcessInspectionId ?? "").trim();
  const linkedTestReportId = String(input.linkedTestReportId ?? "").trim();

  if (input.sourceType === "material_inspection" && !linkedMaterialInspectionId) {
    throw VALIDATION_ERROR("출처 유형이 자재 검사이면 참조 자재 검사를 선택해야 합니다.");
  }
  if (input.sourceType === "process_inspection" && !linkedProcessInspectionId) {
    throw VALIDATION_ERROR("출처 유형이 공정 검사이면 참조 공정 검사를 선택해야 합니다.");
  }
  if (input.sourceType === "test_report" && !linkedTestReportId) {
    throw VALIDATION_ERROR("출처 유형이 시험 성적서이면 참조 시험 성적서를 선택해야 합니다.");
  }

  await Promise.all([
    assertReferenceAvailable(siteId, {
      currentId,
      fieldName: "linkedMaterialInspectionId",
      referenceId: linkedMaterialInspectionId,
      label: "참조 자재 검사",
    }),
    assertReferenceAvailable(siteId, {
      currentId,
      fieldName: "linkedProcessInspectionId",
      referenceId: linkedProcessInspectionId,
      label: "참조 공정 검사",
    }),
    assertReferenceAvailable(siteId, {
      currentId,
      fieldName: "linkedTestReportId",
      referenceId: linkedTestReportId,
      label: "참조 시험 성적서",
    }),
  ]);

  const [materialInspection, processInspection, testReport] = await Promise.all([
    linkedMaterialInspectionId
      ? MaterialInspection.findOne({ _id: linkedMaterialInspectionId, siteId })
          .select({ materialName: 1, specification: 1 })
          .lean()
      : null,
    linkedProcessInspectionId
      ? QcProcessInspection.findOne({ _id: linkedProcessInspectionId, siteId })
          .select({ inspectionTitle: 1, location: 1 })
          .lean()
      : null,
    linkedTestReportId
      ? QcTestReport.findOne({ _id: linkedTestReportId, siteId })
          .select({ sampleName: 1, certificateNo: 1 })
          .lean()
      : null,
  ]);

  if (linkedMaterialInspectionId && !materialInspection) {
    throw VALIDATION_ERROR("참조 자재 검사를 찾을 수 없습니다.");
  }
  if (linkedProcessInspectionId && !processInspection) {
    throw VALIDATION_ERROR("참조 공정 검사를 찾을 수 없습니다.");
  }
  if (linkedTestReportId && !testReport) {
    throw VALIDATION_ERROR("참조 시험 성적서를 찾을 수 없습니다.");
  }

  const materialTitle = materialInspection ? buildMaterialTitle(materialInspection) : "";
  const processTitle = processInspection ? buildProcessTitle(processInspection) : "";
  const testReportTitle = testReport ? buildTestReportTitle(testReport) : "";

  return {
    linkedMaterialInspectionId: linkedMaterialInspectionId ? new mongoose.Types.ObjectId(linkedMaterialInspectionId) : undefined,
    linkedMaterialInspectionTitle: materialTitle,
    linkedProcessInspectionId: linkedProcessInspectionId ? new mongoose.Types.ObjectId(linkedProcessInspectionId) : undefined,
    linkedProcessInspectionTitle: processTitle,
    linkedTestReportId: linkedTestReportId ? new mongoose.Types.ObjectId(linkedTestReportId) : undefined,
    linkedTestReportTitle: testReportTitle,
    sourceSummary:
      String(input.sourceSummary ?? "").trim() ||
      (input.sourceType === "material_inspection"
        ? materialTitle
        : input.sourceType === "process_inspection"
          ? processTitle
          : input.sourceType === "test_report"
            ? testReportTitle
            : ""),
  };
}

export function validateQcNonconformanceLifecycle(input: {
  status: QcNonconformanceStatus;
  verificationResult: QcNonconformanceVerificationResult;
  verifiedAt?: Date | null;
}) {
  if (input.status === "closed" && input.verificationResult !== "pass") {
    throw VALIDATION_ERROR("종결하려면 검증 결과가 적합이어야 합니다.");
  }
  if (input.verificationResult !== "pending" && !input.verifiedAt) {
    throw VALIDATION_ERROR("검증 결과를 기록하려면 검증일이 필요합니다.");
  }
}

export function inferQcNonconformanceHistoryAction(
  previous: LifecycleState,
  next: LifecycleState,
  reminderRequested = false,
): QcNonconformanceHistoryAction {
  if (reminderRequested) {
    return "reminder_sent";
  }
  if (previous.status !== "closed" && next.status === "closed") {
    return "closed";
  }
  if (previous.verificationResult !== next.verificationResult && next.verificationResult !== "pending") {
    return "verification_completed";
  }
  if (previous.status !== next.status) {
    return "status_changed";
  }
  return "updated";
}

export async function syncQcNonconformanceLinks(
  siteId: string,
  current: QcNonconformanceReferenceSnapshot,
  next: QcNonconformanceReferenceSnapshot,
  ncrNo: string,
) {
  const clearMaterialId = current.linkedMaterialInspectionId && current.linkedMaterialInspectionId !== next.linkedMaterialInspectionId;
  const clearTestReportId = current.linkedTestReportId && current.linkedTestReportId !== next.linkedTestReportId;

  const tasks: Promise<unknown>[] = [];

  if (clearMaterialId) {
    tasks.push(
      MaterialInspection.updateOne(
        {
          _id: current.linkedMaterialInspectionId,
          siteId,
          ncrReference: ncrNo,
        },
        { $set: { ncrStatus: "none", ncrReference: "" } },
      ),
    );
  }

  if (clearTestReportId) {
    tasks.push(
      QcTestReport.updateOne(
        {
          _id: current.linkedTestReportId,
          siteId,
          ncrReference: ncrNo,
        },
        { $set: { ncrStatus: "none", ncrReference: "" } },
      ),
    );
  }

  if (next.linkedMaterialInspectionId) {
    tasks.push(
      MaterialInspection.updateOne(
        { _id: next.linkedMaterialInspectionId, siteId },
        { $set: { ncrStatus: "linked", ncrReference: ncrNo } },
      ),
    );
  }

  if (next.linkedTestReportId) {
    tasks.push(
      QcTestReport.updateOne(
        { _id: next.linkedTestReportId, siteId },
        { $set: { ncrStatus: "linked", ncrReference: ncrNo } },
      ),
    );
  }

  await Promise.all(tasks);
}

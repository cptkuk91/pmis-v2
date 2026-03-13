import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import type {
  QcMaterialInspectionDisposition,
  QcMaterialInspectionHistoryAction,
  QcMaterialInspectionResult,
} from "@/lib/qc-material-inspections";
import QcInspectionTestPlan from "@/models/QcInspectionTestPlan";

type MaterialInspectionItpInput = {
  linkedItpPlanId?: string;
  linkedItpCheckpointId?: string;
  inspectionStandard?: string;
};

type MaterialInspectionItpReference = {
  linkedItpPlanId?: mongoose.Types.ObjectId;
  linkedItpPlanTitle: string;
  linkedItpCheckpointId: string;
  linkedItpCheckpointTitle: string;
  inspectionStandard: string;
};

type MaterialInspectionLifecycleState = {
  result: QcMaterialInspectionResult;
  disposition: QcMaterialInspectionDisposition;
};

export async function resolveQcMaterialInspectionItpReference(
  siteId: string,
  input: MaterialInspectionItpInput,
): Promise<MaterialInspectionItpReference> {
  const linkedItpPlanId = String(input.linkedItpPlanId ?? "").trim();
  const linkedItpCheckpointId = String(input.linkedItpCheckpointId ?? "").trim();
  const inspectionStandard = String(input.inspectionStandard ?? "").trim();

  if (!linkedItpPlanId) {
    return {
      linkedItpPlanTitle: "",
      linkedItpCheckpointId: "",
      linkedItpCheckpointTitle: "",
      inspectionStandard,
    };
  }

  const plan = await QcInspectionTestPlan.findOne({
    _id: linkedItpPlanId,
    siteId,
  })
    .select({ planTitle: 1, checkpoints: 1 })
    .lean();

  if (!plan) {
    throw VALIDATION_ERROR("연결된 ITP를 찾을 수 없습니다.");
  }

  const checkpoint = linkedItpCheckpointId
    ? plan.checkpoints.find((item) => item.checkpointId === linkedItpCheckpointId)
    : null;

  if (linkedItpCheckpointId && !checkpoint) {
    throw VALIDATION_ERROR("선택한 ITP 체크포인트를 찾을 수 없습니다.");
  }

  return {
    linkedItpPlanId: new mongoose.Types.ObjectId(linkedItpPlanId),
    linkedItpPlanTitle: plan.planTitle ?? "",
    linkedItpCheckpointId,
    linkedItpCheckpointTitle: checkpoint?.checkpointTitle ?? "",
    inspectionStandard: inspectionStandard || checkpoint?.acceptanceCriteria || "",
  };
}

export function inferQcMaterialInspectionHistoryAction(
  previous: MaterialInspectionLifecycleState,
  next: MaterialInspectionLifecycleState,
): QcMaterialInspectionHistoryAction {
  if (next.disposition === "hold" && previous.disposition !== "hold") {
    return "held";
  }

  if (next.disposition === "returned" && previous.disposition !== "returned") {
    return "returned";
  }

  if (next.result === "reinspection" && previous.result !== "reinspection") {
    return "reinspection_requested";
  }

  if (previous.result === "reinspection" && next.result !== "reinspection") {
    return "reinspection_completed";
  }

  return "updated";
}

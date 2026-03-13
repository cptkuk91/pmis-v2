import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import type {
  QcProcessInspectionCorrectiveActionStatus,
  QcProcessInspectionHistoryAction,
  QcProcessInspectionStatus,
} from "@/lib/qc-process-inspections";
import QcInspectionTestPlan from "@/models/QcInspectionTestPlan";

type ProcessInspectionItpInput = {
  linkedItpPlanId?: string;
  linkedItpCheckpointId?: string;
  acceptanceCriteria?: string;
};

type ProcessInspectionItpReference = {
  linkedItpPlanId?: mongoose.Types.ObjectId;
  linkedItpPlanTitle: string;
  linkedItpCheckpointId: string;
  linkedItpCheckpointTitle: string;
  acceptanceCriteria: string;
};

type ProcessInspectionLifecycleState = {
  status: QcProcessInspectionStatus;
  correctiveActionStatus: QcProcessInspectionCorrectiveActionStatus;
};

export async function resolveQcProcessInspectionItpReference(
  siteId: string,
  input: ProcessInspectionItpInput,
): Promise<ProcessInspectionItpReference> {
  const linkedItpPlanId = String(input.linkedItpPlanId ?? "").trim();
  const linkedItpCheckpointId = String(input.linkedItpCheckpointId ?? "").trim();
  const acceptanceCriteria = String(input.acceptanceCriteria ?? "").trim();

  if (!linkedItpPlanId) {
    return {
      linkedItpPlanTitle: "",
      linkedItpCheckpointId: "",
      linkedItpCheckpointTitle: "",
      acceptanceCriteria,
    };
  }

  const plan = await QcInspectionTestPlan.findOne({ _id: linkedItpPlanId, siteId })
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
    acceptanceCriteria: acceptanceCriteria || checkpoint?.acceptanceCriteria || "",
  };
}

export function inferQcProcessInspectionHistoryAction(
  previous: ProcessInspectionLifecycleState,
  next: ProcessInspectionLifecycleState,
): QcProcessInspectionHistoryAction {
  if (previous.correctiveActionStatus !== "completed" && next.correctiveActionStatus === "completed") {
    return "corrective_action_completed";
  }

  if (previous.correctiveActionStatus === "none" && next.correctiveActionStatus !== "none") {
    return "corrective_action_requested";
  }

  if (previous.status !== "in_progress" && next.status === "in_progress") {
    return "inspection_started";
  }

  if (previous.status !== "approved" && next.status === "approved") {
    return "approved";
  }

  return "updated";
}

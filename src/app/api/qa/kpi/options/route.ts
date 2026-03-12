import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import {
  QA_KPI_CYCLE_LABELS,
  QA_KPI_SOURCE_METRIC_LABELS,
  QA_KPI_TARGET_DIRECTION_LABELS,
} from "@/lib/qa-kpi";
import QaPolicyGoal from "@/models/QaPolicyGoal";

type PolicyGoalOption = {
  key: string;
  policyGoalId: string;
  year: number;
  policyTitle: string;
  policyStatus: string;
  goalId: string;
  goalTitle: string;
  metricName: string;
  targetValue: string;
  unit: string;
  measurementCycle: string;
  ownerName: string;
  ownerMemberId: string;
};

export async function GET() {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId();
    if (!siteId) {
      return success({
        policyGoalOptions: [] as PolicyGoalOption[],
        sourceMetricOptions: Object.entries(QA_KPI_SOURCE_METRIC_LABELS).map(([value, label]) => ({ value, label })),
        cycleOptions: Object.entries(QA_KPI_CYCLE_LABELS).map(([value, label]) => ({ value, label })),
        directionOptions: Object.entries(QA_KPI_TARGET_DIRECTION_LABELS).map(([value, label]) => ({ value, label })),
      });
    }

    const policyGoals = await QaPolicyGoal.find({ siteId })
      .sort({ status: 1, year: -1, revisionNo: -1, createdAt: -1 })
      .select({ year: 1, policyTitle: 1, status: 1, goals: 1 })
      .lean();

    const policyGoalOptions = policyGoals
      .flatMap((item) =>
        item.goals.map((goal) => ({
          key: `${String(item._id)}:${goal.goalId}`,
          policyGoalId: String(item._id),
          year: item.year,
          policyTitle: item.policyTitle,
          policyStatus: item.status,
          goalId: goal.goalId,
          goalTitle: goal.title,
          metricName: goal.metricName,
          targetValue: goal.targetValue,
          unit: goal.unit,
          measurementCycle: goal.measurementCycle,
          ownerName: goal.ownerName,
          ownerMemberId: goal.ownerMemberId,
        })),
      )
      .sort((left, right) => {
        if (left.policyStatus !== right.policyStatus) {
          if (left.policyStatus === "active") {
            return -1;
          }
          if (right.policyStatus === "active") {
            return 1;
          }
        }
        if (left.year !== right.year) {
          return right.year - left.year;
        }
        return left.metricName.localeCompare(right.metricName, "ko");
      });

    return success({
      policyGoalOptions,
      sourceMetricOptions: Object.entries(QA_KPI_SOURCE_METRIC_LABELS).map(([value, label]) => ({ value, label })),
      cycleOptions: Object.entries(QA_KPI_CYCLE_LABELS).map(([value, label]) => ({ value, label })),
      directionOptions: Object.entries(QA_KPI_TARGET_DIRECTION_LABELS).map(([value, label]) => ({ value, label })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

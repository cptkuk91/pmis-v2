import QaAudit from "@/models/QaAudit";
import QaCapa from "@/models/QaCapa";
import QaKpiDefinition from "@/models/QaKpiDefinition";
import QaPolicyGoal from "@/models/QaPolicyGoal";
import { buildQaKpiSummaryItems } from "@/lib/qa-kpi-summary";

export type QaOpsOverdueCapaItem = {
  _id: string;
  title: string;
  assigneeName: string;
  dueDate?: Date | string | null;
};

export type QaOpsPendingAuditItem = {
  _id: string;
  auditTitle: string;
  auditLeadName: string;
  plannedDate?: Date | string | null;
  status: string;
};

export type QaOpsKpiAlertItem = {
  _id: string;
  metricCode: string;
  metricName: string;
  currentPeriodLabel: string;
  currentValue: number;
  targetValue: number;
  warningThreshold: number;
  unit: string;
  alertMessage: string;
};

export type QaOpsSnapshot = {
  activePolicyGoalCount: number;
  overdueCapaCount: number;
  pendingAuditCount: number;
  kpiAlertCount: number;
  overdueCapas: QaOpsOverdueCapaItem[];
  pendingAudits: QaOpsPendingAuditItem[];
  kpiAlerts: QaOpsKpiAlertItem[];
};

function getAlertGap(item: {
  currentValue: number;
  warningThreshold?: number | null;
  targetValue: number;
  targetDirection: "at_least" | "at_most";
}) {
  const threshold = item.warningThreshold ?? item.targetValue;
  if (item.targetDirection === "at_least") {
    return threshold - item.currentValue;
  }
  return item.currentValue - threshold;
}

export async function getQaOpsSnapshot(
  siteId: string,
  options: {
    limit?: number;
    referenceDate?: Date;
    kpiYear?: number;
  } = {},
): Promise<QaOpsSnapshot> {
  const limit = Math.max(1, Math.min(options.limit ?? 3, 10));
  const referenceDate = options.referenceDate ?? new Date();
  const kpiYear = options.kpiYear ?? referenceDate.getFullYear();

  const startOfToday = new Date(referenceDate);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const overdueCapaFilter = {
    siteId,
    status: { $ne: "completed" },
    dueDate: { $lt: startOfToday },
  };
  const pendingAuditFilter = {
    siteId,
    status: { $in: ["planned", "in_progress"] },
    plannedDate: { $lt: startOfTomorrow },
  };

  const [
    activePolicyGoalCount,
    overdueCapaCount,
    overdueCapas,
    pendingAuditCount,
    pendingAudits,
    kpiDefinitions,
  ] = await Promise.all([
    QaPolicyGoal.countDocuments({ siteId, status: "active" }),
    QaCapa.countDocuments(overdueCapaFilter),
    QaCapa.find(overdueCapaFilter)
      .sort({ dueDate: 1, priority: -1, createdAt: -1 })
      .limit(limit)
      .select({ title: 1, assigneeName: 1, dueDate: 1 })
      .lean(),
    QaAudit.countDocuments(pendingAuditFilter),
    QaAudit.find(pendingAuditFilter)
      .sort({ plannedDate: 1, status: 1, createdAt: -1 })
      .limit(limit)
      .select({ auditTitle: 1, auditLeadName: 1, plannedDate: 1, status: 1 })
      .lean(),
    QaKpiDefinition.find({ siteId, isActive: true })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
  ]);

  const kpiSummaryItems = await buildQaKpiSummaryItems(
    siteId,
    kpiDefinitions.map((item) => ({
      ...item,
      _id: String(item._id),
    })),
    kpiYear,
    referenceDate,
  );

  const kpiAlerts = kpiSummaryItems
    .filter((item) => item.isAlert)
    .sort((left, right) => getAlertGap(right) - getAlertGap(left))
    .slice(0, limit)
    .map((item) => ({
      _id: item._id,
      metricCode: item.metricCode,
      metricName: item.metricName,
      currentPeriodLabel: item.currentPeriodLabel,
      currentValue: item.currentValue,
      targetValue: item.targetValue,
      warningThreshold: item.warningThreshold ?? item.targetValue,
      unit: item.unit,
      alertMessage: item.alertMessage,
    }));

  return {
    activePolicyGoalCount,
    overdueCapaCount,
    pendingAuditCount,
    kpiAlertCount: kpiSummaryItems.filter((item) => item.isAlert).length,
    overdueCapas: overdueCapas.map((item) => ({
      _id: String(item._id),
      title: String(item.title ?? ""),
      assigneeName: String(item.assigneeName ?? ""),
      dueDate: item.dueDate ?? null,
    })),
    pendingAudits: pendingAudits.map((item) => ({
      _id: String(item._id),
      auditTitle: String(item.auditTitle ?? ""),
      auditLeadName: String(item.auditLeadName ?? ""),
      plannedDate: item.plannedDate ?? null,
      status: String(item.status ?? ""),
    })),
    kpiAlerts,
  };
}

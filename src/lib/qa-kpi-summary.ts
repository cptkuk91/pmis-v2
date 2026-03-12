import QaAudit from "@/models/QaAudit";
import QaCapa from "@/models/QaCapa";
import QaPartnerAssurance from "@/models/QaPartnerAssurance";
import {
  calculateQaKpiAchievementRate,
  isQaKpiAlert,
  type QaKpiCycle,
  type QaKpiSourceMetric,
  type QaKpiTargetDirection,
} from "@/lib/qa-kpi";

export type QaKpiDefinitionLike = {
  _id: string;
  metricCode: string;
  metricName: string;
  sourceMetric: QaKpiSourceMetric;
  measurementCycle: QaKpiCycle;
  unit: string;
  targetDirection: QaKpiTargetDirection;
  targetValue: number;
  warningThreshold?: number | null;
  linkedPolicyGoalId?: string;
  linkedPolicyGoalYear?: number | null;
  linkedPolicyGoalTitle?: string;
  linkedPolicyGoalGoalId?: string;
  linkedPolicyGoalMetricName?: string;
  ownerName?: string;
  ownerMemberId?: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type AuditMetricRow = {
  plannedDate: Date;
  actualDate?: Date | null;
  status: string;
  nonconformityCount: number;
};

type CapaMetricRow = {
  dueDate: Date;
  verifiedAt?: Date | null;
};

type PartnerMetricRow = {
  evaluationDate: Date;
  riskLevel: string;
  followUpStatus: string;
  totalScore: number;
  maxScore: number;
};

export type QaKpiTrendPoint = {
  key: string;
  label: string;
  actualValue: number;
  targetValue: number;
  achievementRate: number;
  isAlert: boolean;
};

export type QaKpiSummaryItem = QaKpiDefinitionLike & {
  currentPeriodLabel: string;
  currentValue: number;
  achievementRate: number;
  isAlert: boolean;
  alertMessage: string;
  trend: QaKpiTrendPoint[];
};

type QaKpiDatasets = {
  audits: AuditMetricRow[];
  capas: CapaMetricRow[];
  partnerAssurance: PartnerMetricRow[];
};

type Period = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function roundValue(value: number) {
  return Number(value.toFixed(1));
}

function createMonthlyPeriods(year: number): Period[] {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 1));
    return {
      key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: `${monthIndex + 1}월`,
      start,
      end,
    };
  });
}

function createQuarterlyPeriods(year: number): Period[] {
  return Array.from({ length: 4 }, (_, quarterIndex) => {
    const start = new Date(Date.UTC(year, quarterIndex * 3, 1));
    const end = new Date(Date.UTC(year, quarterIndex * 3 + 3, 1));
    return {
      key: `${year}-Q${quarterIndex + 1}`,
      label: `${quarterIndex + 1}분기`,
      start,
      end,
    };
  });
}

function createYearlyPeriods(year: number): Period[] {
  return [
    {
      key: String(year),
      label: `${year}년`,
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
    },
  ];
}

function getPeriods(year: number, cycle: QaKpiCycle): Period[] {
  if (cycle === "quarterly") {
    return createQuarterlyPeriods(year);
  }
  if (cycle === "yearly") {
    return createYearlyPeriods(year);
  }
  return createMonthlyPeriods(year);
}

function isDateInPeriod(date: Date | null | undefined, period: Period) {
  if (!date || Number.isNaN(date.getTime())) {
    return false;
  }
  return date >= period.start && date < period.end;
}

function getCurrentPeriodIndex(year: number, cycle: QaKpiCycle, referenceDate: Date) {
  const currentYear = referenceDate.getUTCFullYear();
  if (year < currentYear) {
    return cycle === "yearly" ? 0 : cycle === "quarterly" ? 3 : 11;
  }
  if (year > currentYear) {
    return 0;
  }

  if (cycle === "yearly") {
    return 0;
  }
  if (cycle === "quarterly") {
    return Math.floor(referenceDate.getUTCMonth() / 3);
  }
  return referenceDate.getUTCMonth();
}

function buildAlertMessage(item: QaKpiDefinitionLike, point: QaKpiTrendPoint) {
  const threshold = item.warningThreshold ?? item.targetValue;
  const comparator = item.targetDirection === "at_least" ? "미만" : "초과";
  return `${point.label} 실적 ${point.actualValue}${item.unit} (${threshold}${item.unit} ${comparator})`;
}

async function loadDatasets(siteId: string, year: number): Promise<QaKpiDatasets> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [audits, capas, partnerAssurance] = await Promise.all([
    QaAudit.find({
      siteId,
      plannedDate: { $gte: start, $lt: end },
    })
      .select({ plannedDate: 1, actualDate: 1, status: 1, nonconformityCount: 1 })
      .lean(),
    QaCapa.find({
      siteId,
      dueDate: { $gte: start, $lt: end },
    })
      .select({ dueDate: 1, verifiedAt: 1 })
      .lean(),
    QaPartnerAssurance.find({
      siteId,
      evaluationDate: { $gte: start, $lt: end },
    })
      .select({ evaluationDate: 1, riskLevel: 1, followUpStatus: 1, totalScore: 1, maxScore: 1 })
      .lean(),
  ]);

  return { audits, capas, partnerAssurance };
}

function computeActualValueForPeriod(
  sourceMetric: QaKpiSourceMetric,
  period: Period,
  datasets: QaKpiDatasets,
  referenceDate: Date,
) {
  if (sourceMetric === "audit_completion_rate") {
    const periodAudits = datasets.audits.filter((audit) => isDateInPeriod(new Date(audit.plannedDate), period));
    if (!periodAudits.length) {
      return 0;
    }
    const completedCount = periodAudits.filter(
      (audit) => audit.status === "completed" || audit.status === "closed",
    ).length;
    return roundValue((completedCount / periodAudits.length) * 100);
  }

  if (sourceMetric === "audit_nonconformity_count") {
    return datasets.audits
      .filter((audit) => isDateInPeriod(new Date(audit.plannedDate), period))
      .reduce((sum, audit) => sum + Number(audit.nonconformityCount ?? 0), 0);
  }

  if (sourceMetric === "capa_overdue_count") {
    return datasets.capas.filter((capa) => {
      const dueDate = new Date(capa.dueDate);
      if (!isDateInPeriod(dueDate, period)) {
        return false;
      }

      const effectiveReference = referenceDate < period.end ? referenceDate : new Date(period.end.getTime() - 1);
      if (dueDate > effectiveReference) {
        return false;
      }

      if (!capa.verifiedAt) {
        return true;
      }

      return new Date(capa.verifiedAt) > dueDate;
    }).length;
  }

  if (sourceMetric === "partner_high_risk_count") {
    return datasets.partnerAssurance.filter((item) => {
      return isDateInPeriod(new Date(item.evaluationDate), period) && item.riskLevel === "high";
    }).length;
  }

  if (sourceMetric === "partner_follow_up_pending_count") {
    return datasets.partnerAssurance.filter((item) => {
      return isDateInPeriod(new Date(item.evaluationDate), period) && item.followUpStatus === "requested";
    }).length;
  }

  const periodRows = datasets.partnerAssurance.filter((item) => isDateInPeriod(new Date(item.evaluationDate), period));
  if (!periodRows.length) {
    return 0;
  }
  const ratios = periodRows
    .map((item) => {
      if (!item.maxScore) {
        return 0;
      }
      return (item.totalScore / item.maxScore) * 100;
    })
    .filter((value) => Number.isFinite(value));

  if (!ratios.length) {
    return 0;
  }

  return roundValue(ratios.reduce((sum, value) => sum + value, 0) / ratios.length);
}

export async function buildQaKpiSummaryItems(
  siteId: string,
  definitions: QaKpiDefinitionLike[],
  year: number,
  referenceDate: Date = new Date(),
): Promise<QaKpiSummaryItem[]> {
  const datasets = await loadDatasets(siteId, year);

  return definitions.map((definition) => {
    const periods = getPeriods(year, definition.measurementCycle);
    const trend = periods.map((period) => {
      const actualValue = computeActualValueForPeriod(definition.sourceMetric, period, datasets, referenceDate);
      const threshold = definition.warningThreshold ?? definition.targetValue;
      const achievementRate = calculateQaKpiAchievementRate(
        actualValue,
        definition.targetValue,
        definition.targetDirection,
      );

      return {
        key: period.key,
        label: period.label,
        actualValue,
        targetValue: definition.targetValue,
        achievementRate,
        isAlert: isQaKpiAlert(actualValue, threshold, definition.targetDirection),
      };
    });

    const currentIndex = Math.min(getCurrentPeriodIndex(year, definition.measurementCycle, referenceDate), trend.length - 1);
    const currentPoint = trend[currentIndex] ?? trend[trend.length - 1];

    return {
      ...definition,
      currentPeriodLabel: currentPoint?.label ?? "",
      currentValue: currentPoint?.actualValue ?? 0,
      achievementRate: currentPoint?.achievementRate ?? 100,
      isAlert: currentPoint?.isAlert ?? false,
      alertMessage: currentPoint && currentPoint.isAlert ? buildAlertMessage(definition, currentPoint) : "",
      trend,
    };
  });
}

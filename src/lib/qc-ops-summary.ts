import MaterialInspection from "@/models/MaterialInspection";
import QcHandoverInspection from "@/models/QcHandoverInspection";
import QcNonconformance from "@/models/QcNonconformance";
import QcProcessInspection from "@/models/QcProcessInspection";
import QcTestReport from "@/models/QcTestReport";
import { isQcNonconformanceOverdue } from "@/lib/qc-nonconformance";

type MaterialMetricRow = {
  _id: string;
  materialName: string;
  materialCategory: string;
  inspectionDate: Date;
  result: string;
  supplier?: string;
  updatedAt?: Date | null;
};

type ProcessMetricRow = {
  _id: string;
  inspectionTitle: string;
  workType: string;
  location: string;
  plannedInspectionDate: Date;
  status: string;
  result: string;
  correctiveActionStatus: string;
  updatedAt?: Date | null;
};

type TestMetricRow = {
  _id: string;
  sampleName: string;
  certificateNo: string;
  testType: string;
  testDate: Date;
  result: string;
  deviationRate: number;
  summary: string;
  updatedAt?: Date | null;
};

type NcrMetricRow = {
  _id: string;
  ncrNo: string;
  title: string;
  workType: string;
  status: string;
  dueDate?: Date | null;
  severity?: string;
  severityRank?: number;
  assigneeName?: string;
  occurrenceDate: Date;
  updatedAt?: Date | null;
};

type HandoverMetricRow = {
  _id: string;
  inspectionNo: string;
  inspectionTitle: string;
  inspectionType: string;
  workType: string;
  areaLabel: string;
  unitNo: string;
  zoneName: string;
  plannedInspectionDate: Date;
  status: string;
  approvalStatus: string;
  openFindingCount: number;
  updatedAt?: Date | null;
};

type MonthPeriod = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

export type QcOpsOverdueNcrItem = {
  _id: string;
  ncrNo: string;
  title: string;
  workType: string;
  severity: string;
  assigneeName: string;
  dueDate?: Date | string | null;
};

export type QcOpsPendingHandoverItem = {
  _id: string;
  inspectionNo: string;
  inspectionTitle: string;
  inspectionType: string;
  workType: string;
  areaSummary: string;
  openFindingCount: number;
  approvalStatus: string;
  plannedInspectionDate?: Date | string | null;
};

export type QcOpsFailedTestItem = {
  _id: string;
  sampleName: string;
  certificateNo: string;
  testType: string;
  deviationRate: number;
  summary: string;
  testDate?: Date | string | null;
};

export type QcOpsOpenProcessActionItem = {
  _id: string;
  inspectionTitle: string;
  workType: string;
  location: string;
  correctiveActionStatus: string;
  plannedInspectionDate?: Date | string | null;
};

export type QcOpsWorkTypeRiskItem = {
  workType: string;
  processInspectionCount: number;
  processFailCount: number;
  openCorrectiveActionCount: number;
  ncrCount: number;
  overdueNcrCount: number;
  pendingHandoverCount: number;
  riskScore: number;
};

export type QcOpsTrendPoint = {
  key: string;
  label: string;
  materialInspectionCount: number;
  materialPassRate: number;
  processInspectionCount: number;
  processOpenActionCount: number;
  testOutOfSpecCount: number;
  ncrCount: number;
  handoverPendingCount: number;
};

export type QcOpsSnapshot = {
  monthsBack: number;
  materialInspectionCount: number;
  materialPassCount: number;
  materialFailCount: number;
  materialPassRate: number;
  processOpenActionCount: number;
  processFailCount: number;
  testOutOfSpecCount: number;
  periodNcrCount: number;
  openNcrCount: number;
  overdueNcrCount: number;
  pendingHandoverCount: number;
  approvalRequestedHandoverCount: number;
  topRiskWorkTypeCount: number;
  topRiskWorkTypes: QcOpsWorkTypeRiskItem[];
  overdueNcrs: QcOpsOverdueNcrItem[];
  pendingHandovers: QcOpsPendingHandoverItem[];
  failedTests: QcOpsFailedTestItem[];
  openProcessActions: QcOpsOpenProcessActionItem[];
};

export type QcQualityDashboardSummary = {
  generatedAt: string;
  range: {
    monthsBack: number;
    start: string;
    end: string;
  };
  snapshot: QcOpsSnapshot;
  trend: QcOpsTrendPoint[];
  workTypeRisks: QcOpsWorkTypeRiskItem[];
};

function roundValue(value: number) {
  return Number(value.toFixed(1));
}

function startOfDay(referenceDate: Date) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

function createMonthlyPeriods(referenceDate: Date, monthsBack: number): MonthPeriod[] {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthsBack - 1), 1);
  return Array.from({ length: monthsBack }, (_, index) => {
    const periodStart = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const periodEnd = new Date(start.getFullYear(), start.getMonth() + index + 1, 1);
    return {
      key: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
      label: `${periodStart.getMonth() + 1}월`,
      start: periodStart,
      end: periodEnd,
    };
  });
}

function getWorkTypeKey(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || "미분류";
}

function buildHandoverAreaSummary(item: Pick<HandoverMetricRow, "areaLabel" | "unitNo" | "zoneName">) {
  return [item.areaLabel, item.unitNo, item.zoneName].map((value) => String(value ?? "").trim()).filter(Boolean).join(" / ");
}

function isDateInPeriod(date: Date | null | undefined, period: MonthPeriod) {
  if (!date || Number.isNaN(date.getTime())) {
    return false;
  }
  return date >= period.start && date < period.end;
}

function isProcessActionOpen(status: string) {
  return status === "requested" || status === "in_progress";
}

function isHandoverPending(item: Pick<HandoverMetricRow, "openFindingCount" | "approvalStatus" | "status">) {
  return item.status !== "closed" && (Number(item.openFindingCount ?? 0) > 0 || item.approvalStatus === "requested");
}

function getMaterialPassRate(rows: MaterialMetricRow[]) {
  const decidedRows = rows.filter((item) => item.result !== "pending");
  if (!decidedRows.length) {
    return 0;
  }
  const passCount = decidedRows.filter((item) => item.result === "pass").length;
  return roundValue((passCount / decidedRows.length) * 100);
}

function getRiskScore(item: Omit<QcOpsWorkTypeRiskItem, "riskScore">) {
  return (
    item.processFailCount * 2 +
    item.openCorrectiveActionCount * 2 +
    item.ncrCount * 3 +
    item.overdueNcrCount * 4 +
    item.pendingHandoverCount * 2
  );
}

async function loadQcSnapshotDatasets(siteId: string, referenceDate: Date, monthsBack: number) {
  const periods = createMonthlyPeriods(referenceDate, monthsBack);
  const rangeStart = periods[0]?.start ?? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const rangeEnd = periods[periods.length - 1]?.end ?? new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const today = startOfDay(referenceDate);

  const [
    materialRows,
    periodProcessRows,
    currentOpenProcessRows,
    periodTestRows,
    periodNcrRows,
    currentOpenNcrRows,
    periodHandoverRows,
    currentPendingHandoverRows,
  ] = await Promise.all([
    MaterialInspection.find({
      siteId,
      inspectionDate: { $gte: rangeStart, $lt: rangeEnd },
    })
      .select({ materialName: 1, materialCategory: 1, inspectionDate: 1, result: 1, supplier: 1, updatedAt: 1 })
      .lean<MaterialMetricRow[]>(),
    QcProcessInspection.find({
      siteId,
      plannedInspectionDate: { $gte: rangeStart, $lt: rangeEnd },
    })
      .select({
        inspectionTitle: 1,
        workType: 1,
        location: 1,
        plannedInspectionDate: 1,
        status: 1,
        result: 1,
        correctiveActionStatus: 1,
        updatedAt: 1,
      })
      .lean<ProcessMetricRow[]>(),
    QcProcessInspection.find({
      siteId,
      correctiveActionStatus: { $in: ["requested", "in_progress"] },
    })
      .select({
        inspectionTitle: 1,
        workType: 1,
        location: 1,
        plannedInspectionDate: 1,
        status: 1,
        result: 1,
        correctiveActionStatus: 1,
        updatedAt: 1,
      })
      .lean<ProcessMetricRow[]>(),
    QcTestReport.find({
      siteId,
      testDate: { $gte: rangeStart, $lt: rangeEnd },
    })
      .select({ sampleName: 1, certificateNo: 1, testType: 1, testDate: 1, result: 1, deviationRate: 1, summary: 1, updatedAt: 1 })
      .lean<TestMetricRow[]>(),
    QcNonconformance.find({
      siteId,
      occurrenceDate: { $gte: rangeStart, $lt: rangeEnd },
    })
      .select({
        ncrNo: 1,
        title: 1,
        workType: 1,
        status: 1,
        dueDate: 1,
        severity: 1,
        severityRank: 1,
        assigneeName: 1,
        occurrenceDate: 1,
        updatedAt: 1,
      })
      .lean<NcrMetricRow[]>(),
    QcNonconformance.find({
      siteId,
      status: { $ne: "closed" },
    })
      .select({
        ncrNo: 1,
        title: 1,
        workType: 1,
        status: 1,
        dueDate: 1,
        severity: 1,
        severityRank: 1,
        assigneeName: 1,
        occurrenceDate: 1,
        updatedAt: 1,
      })
      .lean<NcrMetricRow[]>(),
    QcHandoverInspection.find({
      siteId,
      plannedInspectionDate: { $gte: rangeStart, $lt: rangeEnd },
    })
      .select({
        inspectionNo: 1,
        inspectionTitle: 1,
        inspectionType: 1,
        workType: 1,
        areaLabel: 1,
        unitNo: 1,
        zoneName: 1,
        plannedInspectionDate: 1,
        status: 1,
        approvalStatus: 1,
        openFindingCount: 1,
        updatedAt: 1,
      })
      .lean<HandoverMetricRow[]>(),
    QcHandoverInspection.find({
      siteId,
      status: { $ne: "closed" },
      $or: [{ openFindingCount: { $gt: 0 } }, { approvalStatus: "requested" }],
    })
      .select({
        inspectionNo: 1,
        inspectionTitle: 1,
        inspectionType: 1,
        workType: 1,
        areaLabel: 1,
        unitNo: 1,
        zoneName: 1,
        plannedInspectionDate: 1,
        status: 1,
        approvalStatus: 1,
        openFindingCount: 1,
        updatedAt: 1,
      })
      .lean<HandoverMetricRow[]>(),
  ]);

  const overdueNcrRows = currentOpenNcrRows.filter((item) =>
    isQcNonconformanceOverdue({
      dueDate: item.dueDate,
      status: item.status as "open" | "analysis" | "action_in_progress" | "verification" | "closed",
      referenceDate: today,
    }),
  );

  return {
    periods,
    rangeStart,
    rangeEnd,
    today,
    materialRows,
    periodProcessRows,
    currentOpenProcessRows,
    periodTestRows,
    periodNcrRows,
    currentOpenNcrRows,
    overdueNcrRows,
    periodHandoverRows,
    currentPendingHandoverRows,
  };
}

function buildWorkTypeRisks(input: {
  periodProcessRows: ProcessMetricRow[];
  currentOpenProcessRows: ProcessMetricRow[];
  periodNcrRows: NcrMetricRow[];
  overdueNcrRows: NcrMetricRow[];
  periodHandoverRows: HandoverMetricRow[];
  currentPendingHandoverRows: HandoverMetricRow[];
  topRiskLimit: number;
}) {
  const riskMap = new Map<string, Omit<QcOpsWorkTypeRiskItem, "riskScore">>();

  function ensure(workType: string) {
    if (!riskMap.has(workType)) {
      riskMap.set(workType, {
        workType,
        processInspectionCount: 0,
        processFailCount: 0,
        openCorrectiveActionCount: 0,
        ncrCount: 0,
        overdueNcrCount: 0,
        pendingHandoverCount: 0,
      });
    }
    return riskMap.get(workType)!;
  }

  input.periodProcessRows.forEach((row) => {
    const item = ensure(getWorkTypeKey(row.workType));
    item.processInspectionCount += 1;
    if (row.result === "fail" || row.result === "reinspection") {
      item.processFailCount += 1;
    }
  });

  input.currentOpenProcessRows.forEach((row) => {
    const item = ensure(getWorkTypeKey(row.workType));
    item.openCorrectiveActionCount += 1;
  });

  input.periodNcrRows.forEach((row) => {
    const item = ensure(getWorkTypeKey(row.workType));
    item.ncrCount += 1;
  });

  input.overdueNcrRows.forEach((row) => {
    const item = ensure(getWorkTypeKey(row.workType));
    item.overdueNcrCount += 1;
  });

  input.periodHandoverRows.forEach((row) => {
    if (!isHandoverPending(row)) {
      return;
    }
    const item = ensure(getWorkTypeKey(row.workType));
    item.pendingHandoverCount += 1;
  });

  input.currentPendingHandoverRows.forEach((row) => {
    const item = ensure(getWorkTypeKey(row.workType));
    item.pendingHandoverCount += 1;
  });

  return Array.from(riskMap.values())
    .map((item) => ({
      ...item,
      riskScore: getRiskScore(item),
    }))
    .filter((item) => item.riskScore > 0)
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }
      if (right.overdueNcrCount !== left.overdueNcrCount) {
        return right.overdueNcrCount - left.overdueNcrCount;
      }
      return right.openCorrectiveActionCount - left.openCorrectiveActionCount;
    })
    .slice(0, input.topRiskLimit);
}

function buildTrend(input: {
  periods: MonthPeriod[];
  materialRows: MaterialMetricRow[];
  periodProcessRows: ProcessMetricRow[];
  periodTestRows: TestMetricRow[];
  periodNcrRows: NcrMetricRow[];
  periodHandoverRows: HandoverMetricRow[];
}) {
  return input.periods.map((period) => {
    const materialRows = input.materialRows.filter((item) => isDateInPeriod(new Date(item.inspectionDate), period));
    const processRows = input.periodProcessRows.filter((item) =>
      isDateInPeriod(new Date(item.plannedInspectionDate), period),
    );
    const testRows = input.periodTestRows.filter((item) => isDateInPeriod(new Date(item.testDate), period));
    const ncrRows = input.periodNcrRows.filter((item) => isDateInPeriod(new Date(item.occurrenceDate), period));
    const handoverRows = input.periodHandoverRows.filter((item) =>
      isDateInPeriod(new Date(item.plannedInspectionDate), period),
    );

    return {
      key: period.key,
      label: period.label,
      materialInspectionCount: materialRows.length,
      materialPassRate: getMaterialPassRate(materialRows),
      processInspectionCount: processRows.length,
      processOpenActionCount: processRows.filter((item) => isProcessActionOpen(item.correctiveActionStatus)).length,
      testOutOfSpecCount: testRows.filter((item) => item.result === "fail").length,
      ncrCount: ncrRows.length,
      handoverPendingCount: handoverRows.filter((item) => isHandoverPending(item)).length,
    };
  });
}

export async function getQcOpsSnapshot(
  siteId: string,
  options: {
    limit?: number;
    referenceDate?: Date;
    monthsBack?: number;
    topRiskLimit?: number;
  } = {},
): Promise<QcOpsSnapshot> {
  const limit = Math.max(1, Math.min(options.limit ?? 3, 10));
  const monthsBack = Math.max(3, Math.min(options.monthsBack ?? 6, 12));
  const topRiskLimit = Math.max(limit, Math.min(options.topRiskLimit ?? 5, 12));
  const referenceDate = options.referenceDate ?? new Date();

  const datasets = await loadQcSnapshotDatasets(siteId, referenceDate, monthsBack);
  const workTypeRisks = buildWorkTypeRisks({
    periodProcessRows: datasets.periodProcessRows,
    currentOpenProcessRows: datasets.currentOpenProcessRows,
    periodNcrRows: datasets.periodNcrRows,
    overdueNcrRows: datasets.overdueNcrRows,
    periodHandoverRows: datasets.periodHandoverRows,
    currentPendingHandoverRows: datasets.currentPendingHandoverRows,
    topRiskLimit,
  });

  const materialPassCount = datasets.materialRows.filter((item) => item.result === "pass").length;
  const materialFailCount = datasets.materialRows.filter(
    (item) => item.result === "fail" || item.result === "reinspection",
  ).length;

  const overdueNcrs = datasets.overdueNcrRows
    .slice()
    .sort((left, right) => {
      const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }
      return Number(right.severityRank ?? 0) - Number(left.severityRank ?? 0);
    })
    .slice(0, limit)
    .map((item) => ({
      _id: String(item._id),
      ncrNo: String(item.ncrNo ?? ""),
      title: String(item.title ?? ""),
      workType: getWorkTypeKey(item.workType),
      severity: String(item.severity ?? "medium"),
      assigneeName: String(item.assigneeName ?? ""),
      dueDate: item.dueDate ?? null,
    }));

  const pendingHandovers = datasets.currentPendingHandoverRows
    .slice()
    .sort((left, right) => {
      if (right.openFindingCount !== left.openFindingCount) {
        return Number(right.openFindingCount ?? 0) - Number(left.openFindingCount ?? 0);
      }
      return new Date(left.plannedInspectionDate).getTime() - new Date(right.plannedInspectionDate).getTime();
    })
    .slice(0, limit)
    .map((item) => ({
      _id: String(item._id),
      inspectionNo: String(item.inspectionNo ?? ""),
      inspectionTitle: String(item.inspectionTitle ?? ""),
      inspectionType: String(item.inspectionType ?? "acceptance"),
      workType: getWorkTypeKey(item.workType),
      areaSummary: buildHandoverAreaSummary(item) || "영역 미입력",
      openFindingCount: Number(item.openFindingCount ?? 0),
      approvalStatus: String(item.approvalStatus ?? "none"),
      plannedInspectionDate: item.plannedInspectionDate ?? null,
    }));

  const failedTests = datasets.periodTestRows
    .filter((item) => item.result === "fail")
    .slice()
    .sort((left, right) => {
      const dateGap = new Date(right.testDate).getTime() - new Date(left.testDate).getTime();
      if (dateGap !== 0) {
        return dateGap;
      }
      return Number(right.deviationRate ?? 0) - Number(left.deviationRate ?? 0);
    })
    .slice(0, limit)
    .map((item) => ({
      _id: String(item._id),
      sampleName: String(item.sampleName ?? ""),
      certificateNo: String(item.certificateNo ?? ""),
      testType: String(item.testType ?? ""),
      deviationRate: roundValue(Number(item.deviationRate ?? 0)),
      summary: String(item.summary ?? ""),
      testDate: item.testDate ?? null,
    }));

  const openProcessActions = datasets.currentOpenProcessRows
    .slice()
    .sort((left, right) => new Date(left.plannedInspectionDate).getTime() - new Date(right.plannedInspectionDate).getTime())
    .slice(0, limit)
    .map((item) => ({
      _id: String(item._id),
      inspectionTitle: String(item.inspectionTitle ?? ""),
      workType: getWorkTypeKey(item.workType),
      location: String(item.location ?? ""),
      correctiveActionStatus: String(item.correctiveActionStatus ?? "requested"),
      plannedInspectionDate: item.plannedInspectionDate ?? null,
    }));

  return {
    monthsBack,
    materialInspectionCount: datasets.materialRows.length,
    materialPassCount,
    materialFailCount,
    materialPassRate: getMaterialPassRate(datasets.materialRows),
    processOpenActionCount: datasets.currentOpenProcessRows.length,
    processFailCount: datasets.periodProcessRows.filter(
      (item) => item.result === "fail" || item.result === "reinspection",
    ).length,
    testOutOfSpecCount: datasets.periodTestRows.filter((item) => item.result === "fail").length,
    periodNcrCount: datasets.periodNcrRows.length,
    openNcrCount: datasets.currentOpenNcrRows.length,
    overdueNcrCount: datasets.overdueNcrRows.length,
    pendingHandoverCount: datasets.currentPendingHandoverRows.length,
    approvalRequestedHandoverCount: datasets.currentPendingHandoverRows.filter(
      (item) => item.approvalStatus === "requested",
    ).length,
    topRiskWorkTypeCount: workTypeRisks.length,
    topRiskWorkTypes: workTypeRisks,
    overdueNcrs,
    pendingHandovers,
    failedTests,
    openProcessActions,
  };
}

export async function buildQcQualityDashboardSummary(
  siteId: string,
  options: {
    referenceDate?: Date;
    monthsBack?: number;
    limit?: number;
    topRiskLimit?: number;
  } = {},
): Promise<QcQualityDashboardSummary> {
  const referenceDate = options.referenceDate ?? new Date();
  const monthsBack = Math.max(3, Math.min(options.monthsBack ?? 6, 12));
  const periods = createMonthlyPeriods(referenceDate, monthsBack);
  const snapshot = await getQcOpsSnapshot(siteId, {
    referenceDate,
    monthsBack,
    limit: options.limit,
    topRiskLimit: options.topRiskLimit,
  });
  const datasets = await loadQcSnapshotDatasets(siteId, referenceDate, monthsBack);
  const trend = buildTrend({
    periods,
    materialRows: datasets.materialRows,
    periodProcessRows: datasets.periodProcessRows,
    periodTestRows: datasets.periodTestRows,
    periodNcrRows: datasets.periodNcrRows,
    periodHandoverRows: datasets.periodHandoverRows,
  });

  return {
    generatedAt: new Date().toISOString(),
    range: {
      monthsBack,
      start: datasets.rangeStart.toISOString(),
      end: datasets.rangeEnd.toISOString(),
    },
    snapshot,
    trend,
    workTypeRisks: snapshot.topRiskWorkTypes,
  };
}

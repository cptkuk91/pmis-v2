import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

function loadEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const DRY_RUN = process.argv.includes("--dry-run");
const SITE_CODE_FILTERS = getListOption("--site-codes");

const DEFAULT_INSPECTOR_NAME = "QC 관리자";
const DEFAULT_REQUESTER_NAME = "공무 대리";
const DEFAULT_APPROVER_NAME = "현장 소장";
const DEFAULT_ASSIGNEE_NAME = "시공 대리";
const DEFAULT_TESTING_AGENCY = "샘플 품질시험원";

type CounterKey = "material" | "process" | "testReport" | "ncr" | "handover";
type CounterEntry = {
  created: number;
  reused: number;
  updated: number;
};
type Counters = Record<CounterKey, CounterEntry>;

const COUNTER_KEYS: CounterKey[] = ["material", "process", "testReport", "ncr", "handover"];

function createCounters(): Counters {
  return {
    material: { created: 0, reused: 0, updated: 0 },
    process: { created: 0, reused: 0, updated: 0 },
    testReport: { created: 0, reused: 0, updated: 0 },
    ncr: { created: 0, reused: 0, updated: 0 },
    handover: { created: 0, reused: 0, updated: 0 },
  };
}

function recordCounter(counters: Counters, key: CounterKey, action: keyof CounterEntry) {
  counters[key][action] += 1;
}

function formatCounterSummary(counters: Counters) {
  return COUNTER_KEYS.map((key) => {
    const entry = counters[key];
    return `${key}(created=${entry.created}, reused=${entry.reused}, updated=${entry.updated})`;
  }).join(", ");
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return startOfDay(copy);
}

function formatDatePart(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getListOption(flag: string) {
  const matched = process.argv.find((argument) => argument.startsWith(`${flag}=`));
  if (!matched) {
    return [];
  }

  return matched
    .slice(flag.length + 1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSiteToken(siteCode: unknown, siteId: string) {
  const normalized = String(siteCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return normalized || siteId.slice(-6).toUpperCase();
}

function normalizeComparable(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparable(item, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const plainValue =
      typeof (value as { toObject?: () => unknown }).toObject === "function"
        ? (value as { toObject: () => unknown }).toObject()
        : value;

    if (plainValue && typeof plainValue === "object" && plainValue !== value) {
      return normalizeComparable(plainValue, seen);
    }

    return Object.keys(plainValue as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        if (key.startsWith("$") || key.startsWith("_")) {
          return accumulator;
        }

        accumulator[key] = normalizeComparable((plainValue as Record<string, unknown>)[key], seen);
        return accumulator;
      }, {});
  }

  return value ?? null;
}

function areComparableValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(normalizeComparable(left)) === JSON.stringify(normalizeComparable(right));
}

function pickDocumentValues(document: mongoose.Document, fields: string[]) {
  return fields.reduce<Record<string, unknown>>((accumulator, field) => {
    accumulator[field] = document.get(field);
    return accumulator;
  }, {});
}

async function upsertSeedDocument<T extends mongoose.Document>({
  model,
  filter,
  values,
  label,
  counterKey,
}: {
  model: mongoose.Model<T>;
  filter: Record<string, unknown>;
  values: Record<string, unknown>;
  label: string;
  counterKey: CounterKey;
}) {
  const existing = await model.findOne(filter);

  if (!existing) {
    console.log(`  [create][${counterKey}] ${label}`);
    recordCounter(globalCounters, counterKey, "created");

    if (DRY_RUN) {
      return {
        _id: new mongoose.Types.ObjectId(),
        ...values,
      } as T;
    }

    return model.create(values as never);
  }

  const fieldNames = Object.keys(values);
  const currentValues = pickDocumentValues(existing, fieldNames);

  if (areComparableValuesEqual(currentValues, values)) {
    console.log(`  [reuse][${counterKey}] ${label}`);
    recordCounter(globalCounters, counterKey, "reused");
    return existing;
  }

  console.log(`  [update][${counterKey}] ${label}`);
  recordCounter(globalCounters, counterKey, "updated");

  if (DRY_RUN) {
    return {
      _id: existing._id,
      ...values,
    } as T;
  }

  existing.set(values);
  await existing.save();
  return existing;
}

const globalCounters = createCounters();

async function main() {
  const [
    { connectDB },
    { default: Site },
    { default: MaterialInspection },
    { default: QcProcessInspection },
    { default: QcTestReport },
    { default: QcNonconformance },
    { default: QcHandoverInspection },
    { computeQcTestReportEvaluation },
    { getQcNonconformanceSeverityRank },
    { buildQcNonconformanceNo },
    { buildQcHandoverInspectionNo },
  ] = await Promise.all([
    import("../src/lib/db"),
    import("../src/models/Site"),
    import("../src/models/MaterialInspection"),
    import("../src/models/QcProcessInspection"),
    import("../src/models/QcTestReport"),
    import("../src/models/QcNonconformance"),
    import("../src/models/QcHandoverInspection"),
    import("../src/lib/qc-test-reports"),
    import("../src/lib/qc-nonconformance"),
    import("../src/lib/qc-nonconformance-no"),
    import("../src/lib/qc-handover-inspection-no"),
  ]);

  await connectDB();

  const siteFilter: Record<string, unknown> = { isDeleted: false };
  if (SITE_CODE_FILTERS.length > 0) {
    siteFilter.siteCode = { $in: SITE_CODE_FILTERS };
    console.log(`[filter] siteCodes=${SITE_CODE_FILTERS.join(", ")}`);
  }

  const sites = await Site.find(siteFilter)
    .select({ siteCode: 1, siteName: 1 })
    .sort({ createdAt: 1 });

  if (!sites.length) {
    console.log("현장이 없어 QC seed를 등록하지 않았습니다.");
    await mongoose.disconnect();
    return;
  }

  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const threeDaysAgo = addDays(today, -3);
  const tomorrow = addDays(today, 1);
  const datePart = formatDatePart(today);

  for (const [siteIndex, site] of sites.entries()) {
    const siteId = String(site._id);
    const siteObjectId = new mongoose.Types.ObjectId(siteId);
    const siteToken = getSiteToken(site.siteCode, siteId);
    const siteLabel = `${String(site.siteCode ?? "")} ${String(site.siteName ?? "")}`.trim() || siteId;
    const sampleSequence = 901 + siteIndex;
    const ncrNo = buildQcNonconformanceNo(datePart, sampleSequence);
    const inspectionNo = buildQcHandoverInspectionNo(datePart, sampleSequence);

    console.log(`\n[site] ${siteLabel}`);

    const materialPass = await upsertSeedDocument({
      model: MaterialInspection,
      filter: {
        siteId: siteObjectId,
        materialName: "QC 샘플 철근 D16",
      },
      values: {
        siteId: siteObjectId,
        materialCategory: "rebar",
        materialName: "QC 샘플 철근 D16",
        specification: "SD400, D16",
        supplier: "샘플 철강",
        lotNo: `${siteToken}-RB-01`,
        inboundDate: threeDaysAgo,
        quantity: 120,
        unit: "EA",
        inspectionDate: twoDaysAgo,
        result: "pass",
        disposition: "none",
        inspector: DEFAULT_INSPECTOR_NAME,
        linkedItpPlanTitle: "샘플 철근 반입 검사 ITP",
        linkedItpCheckpointId: "rebar-visual",
        linkedItpCheckpointTitle: "철근 규격 및 외관 확인",
        inspectionStandard: "KS D 3504 기준, 외관 및 규격 적합",
        checklistItems: [
          { itemId: "spec", label: "규격 확인", status: "pass", note: "D16 규격 적합" },
          { itemId: "mill", label: "밀 시트 확인", status: "pass", note: "시험성적서 일치" },
        ],
        decisionReason: "외관, 규격, 시험성적서 모두 적합",
        remarks: "QC 자재 합격률 확인용 샘플",
        attachments: [],
        ncrStatus: "none",
        ncrReference: "",
        history: [
          {
            actionType: "created",
            result: "pass",
            disposition: "none",
            note: "시드 데이터 등록",
            actorName: DEFAULT_INSPECTOR_NAME,
            actionDate: twoDaysAgo,
          },
        ],
      },
      label: "QC 샘플 철근 D16",
      counterKey: "material",
    });

    const materialHold = await upsertSeedDocument({
      model: MaterialInspection,
      filter: {
        siteId: siteObjectId,
        materialName: "QC 샘플 레미콘 24-180-12",
      },
      values: {
        siteId: siteObjectId,
        materialCategory: "concrete",
        materialName: "QC 샘플 레미콘 24-180-12",
        specification: "24-180-12",
        supplier: "샘플 레미콘",
        lotNo: `${siteToken}-RC-01`,
        inboundDate: yesterday,
        quantity: 18,
        unit: "m3",
        inspectionDate: yesterday,
        result: "fail",
        disposition: "hold",
        inspector: DEFAULT_INSPECTOR_NAME,
        linkedItpPlanTitle: "샘플 콘크리트 반입 검사 ITP",
        linkedItpCheckpointId: "concrete-slump",
        linkedItpCheckpointTitle: "슬럼프 및 공기량 확인",
        inspectionStandard: "슬럼프 120+-25mm, 공기량 4.5+-1.5%",
        checklistItems: [
          { itemId: "slump", label: "슬럼프 확인", status: "fail", note: "기준 대비 부족" },
          { itemId: "air", label: "공기량 확인", status: "pass", note: "기준 범위 내" },
        ],
        decisionReason: "슬럼프 기준 미달로 보류 처리",
        remarks: "시험 성적서 및 NCR 연계용 샘플",
        attachments: [],
        ncrStatus: "linked",
        ncrReference: ncrNo,
        history: [
          {
            actionType: "created",
            result: "fail",
            disposition: "hold",
            note: "슬럼프 기준 미달로 보류",
            actorName: DEFAULT_INSPECTOR_NAME,
            actionDate: yesterday,
          },
        ],
      },
      label: "QC 샘플 레미콘 24-180-12",
      counterKey: "material",
    });

    const processInspection = await upsertSeedDocument({
      model: QcProcessInspection,
      filter: {
        siteId: siteObjectId,
        inspectionTitle: "QC 샘플 철근 배근 검사",
      },
      values: {
        siteId: siteObjectId,
        workType: "골조",
        location: "B2 기둥 C열",
        processStep: "철근 배근",
        inspectionTitle: "QC 샘플 철근 배근 검사",
        plannedInspectionDate: yesterday,
        actualInspectionDate: yesterday,
        status: "corrective_action_required",
        result: "fail",
        requesterName: DEFAULT_REQUESTER_NAME,
        requesterMemberId: "",
        inspectorName: DEFAULT_INSPECTOR_NAME,
        inspectorMemberId: "",
        verifierName: DEFAULT_APPROVER_NAME,
        verifierMemberId: "",
        linkedItpPlanTitle: "골조 배근 ITP",
        linkedItpCheckpointId: "frame-cover",
        linkedItpCheckpointTitle: "피복 두께 및 간격 확인",
        acceptanceCriteria: "피복 두께 40mm 이상, 띠철근 간격 기준 준수",
        checklistItems: [
          { itemId: "cover", label: "피복 두께", status: "pass", note: "기준 적합" },
          { itemId: "spacing", label: "띠철근 간격", status: "fail", note: "기준 간격 초과" },
        ],
        inspectionNotes: "기둥 띠철근 간격 일부 초과 확인",
        correctiveActionStatus: "requested",
        correctiveActionRequest: "간격 초과 구간 재시공 후 사진 재제출",
        correctiveActionDueDate: tomorrow,
        correctiveActionSummary: "",
        attachments: [],
        issueStatus: "recommended",
        issueReference: "",
        history: [
          {
            actionType: "created",
            status: "requested",
            correctiveActionStatus: "none",
            note: "검사 요청 등록",
            actorName: DEFAULT_REQUESTER_NAME,
            actionDate: yesterday,
          },
          {
            actionType: "corrective_action_requested",
            status: "corrective_action_required",
            correctiveActionStatus: "requested",
            note: "시정조치 요청",
            actorName: DEFAULT_INSPECTOR_NAME,
            actionDate: yesterday,
          },
        ],
      },
      label: "QC 샘플 철근 배근 검사",
      counterKey: "process",
    });

    const evaluation = computeQcTestReportEvaluation({
      standardValue: 24,
      measuredValue: 21.5,
      toleranceValue: 0,
      judgementRule: "minimum",
    });

    const testReport = await upsertSeedDocument({
      model: QcTestReport,
      filter: {
        siteId: siteObjectId,
        certificateNo: `QCTR-${siteToken}-001`,
      },
      values: {
        siteId: siteObjectId,
        testType: "concrete_strength",
        sourceType: "material_inspection",
        sampleName: "QC 샘플 콘크리트 압축강도",
        specimenNo: `${siteToken}-C-7D`,
        samplingLocation: "B2 기둥 C열",
        samplingDate: yesterday,
        testDate: today,
        linkedMaterialInspectionId: materialHold._id,
        linkedMaterialInspectionTitle: "QC 샘플 레미콘 24-180-12",
        linkedProcessInspectionId: processInspection._id,
        linkedProcessInspectionTitle: "QC 샘플 철근 배근 검사",
        standardValue: 24,
        measuredValue: 21.5,
        toleranceValue: 0,
        unit: "MPa",
        judgementRule: "minimum",
        result: evaluation.result,
        deviationValue: evaluation.deviationValue,
        deviationRate: evaluation.deviationRate,
        testingAgency: DEFAULT_TESTING_AGENCY,
        certificateNo: `QCTR-${siteToken}-001`,
        versionNo: 1,
        status: "reviewed",
        reporterName: DEFAULT_INSPECTOR_NAME,
        reviewerName: DEFAULT_APPROVER_NAME,
        reviewerMemberId: "",
        approverName: "품질 팀장",
        approverMemberId: "",
        summary: "28일 압축강도 기준 미달",
        attachments: [],
        ncrStatus: "linked",
        ncrReference: ncrNo,
        history: [
          {
            actionType: "created",
            status: "submitted",
            result: evaluation.result,
            versionNo: 1,
            note: "시험 성적서 등록",
            actorName: DEFAULT_INSPECTOR_NAME,
            actionDate: today,
          },
          {
            actionType: "reviewed",
            status: "reviewed",
            result: evaluation.result,
            versionNo: 1,
            note: "기준 미달 검토 완료",
            actorName: DEFAULT_APPROVER_NAME,
            actionDate: today,
          },
        ],
      },
      label: `QCTR-${siteToken}-001`,
      counterKey: "testReport",
    });

    const ncr = await upsertSeedDocument({
      model: QcNonconformance,
      filter: {
        siteId: siteObjectId,
        ncrNo,
      },
      values: {
        siteId: siteObjectId,
        ncrNo,
        occurrenceType: "test_failure",
        sourceType: "test_report",
        severity: "high",
        severityRank: getQcNonconformanceSeverityRank("high"),
        title: "QC 샘플 콘크리트 압축강도 부적합",
        description: "시험 성적서 기준 미달로 NCR 발행",
        occurrenceDate: today,
        location: "B2 기둥 C열",
        workType: "골조",
        sourceSummary: `QCTR-${siteToken}-001 / QC 샘플 콘크리트 압축강도`,
        linkedMaterialInspectionId: materialHold._id,
        linkedMaterialInspectionTitle: "QC 샘플 레미콘 24-180-12",
        linkedProcessInspectionId: processInspection._id,
        linkedProcessInspectionTitle: "QC 샘플 철근 배근 검사",
        linkedTestReportId: testReport._id,
        linkedTestReportTitle: "QC 샘플 콘크리트 압축강도",
        reporterName: DEFAULT_INSPECTOR_NAME,
        assigneeName: DEFAULT_ASSIGNEE_NAME,
        assigneeMemberId: "",
        verifierName: DEFAULT_APPROVER_NAME,
        verifierMemberId: "",
        dueDate: yesterday,
        status: "action_in_progress",
        rootCauseSummary: "레미콘 배합 관리와 현장 수용 확인 미흡",
        containmentAction: "해당 타설 구간 추가 코어 채취",
        correctiveActionPlan: "배합 재검토 및 재타설 검토",
        preventiveAction: "반입 검사 입회 및 시험 계획 재강화",
        actionTaken: "자재 반입 배치와 시공 구간 재점검",
        verificationResult: "pending",
        verificationNote: "",
        verifiedAt: null,
        closedAt: null,
        attachments: [],
        history: [
          {
            actionType: "created",
            status: "open",
            verificationResult: "pending",
            note: "시험 부적합으로 NCR 발행",
            actorName: DEFAULT_INSPECTOR_NAME,
            actionDate: today,
          },
          {
            actionType: "status_changed",
            status: "action_in_progress",
            verificationResult: "pending",
            note: "시정조치 진행중",
            actorName: DEFAULT_ASSIGNEE_NAME,
            actionDate: today,
          },
        ],
      },
      label: ncrNo,
      counterKey: "ncr",
    });

    await upsertSeedDocument({
      model: QcHandoverInspection,
      filter: {
        siteId: siteObjectId,
        inspectionNo,
      },
      values: {
        siteId: siteObjectId,
        inspectionNo,
        inspectionType: "acceptance",
        inspectionTitle: "QC 샘플 세대 인수 검사",
        workType: "마감",
        areaType: "unit",
        areaLabel: "101동 1201호",
        unitNo: "1201",
        zoneName: "거실",
        plannedInspectionDate: today,
        inspectedAt: today,
        status: "follow_up",
        result: "conditional",
        openFindingCount: 1,
        requesterName: DEFAULT_REQUESTER_NAME,
        requesterMemberId: "",
        inspectorName: DEFAULT_INSPECTOR_NAME,
        inspectorMemberId: "",
        approverName: DEFAULT_APPROVER_NAME,
        approverMemberId: "",
        approvalStatus: "requested",
        approvedAt: null,
        approvalComment: "보완 완료 후 승인 필요",
        inspectionSummary: "도장 및 실리콘 마감 보완 필요",
        linkedProcessInspectionId: processInspection._id,
        linkedProcessInspectionTitle: "QC 샘플 철근 배근 검사",
        linkedNcrId: ncr._id,
        linkedNcrNo: ncrNo,
        linkedNcrTitle: "QC 샘플 콘크리트 압축강도 부적합",
        checklistItems: [
          {
            itemId: "finish-door",
            sectionTitle: "세대 마감",
            checkpointTitle: "출입문 주변 실리콘 마감",
            spaceLabel: "거실",
            status: "pass",
            note: "주요 틈새 없음",
            findingTitle: "",
            correctiveRequest: "",
            correctiveDueDate: null,
            findingStatus: "none",
            completionNote: "",
          },
          {
            itemId: "finish-wall",
            sectionTitle: "세대 마감",
            checkpointTitle: "도장 마감 상태",
            spaceLabel: "거실",
            status: "conditional",
            note: "벽면 재도장 필요",
            findingTitle: "거실 벽면 도장 보완",
            correctiveRequest: "표면 정리 후 재도장",
            correctiveDueDate: tomorrow,
            findingStatus: "requested",
            completionNote: "",
          },
        ],
        attachments: [],
        history: [
          {
            actionType: "created",
            status: "in_progress",
            approvalStatus: "none",
            note: "인수 검사 등록",
            actorName: DEFAULT_REQUESTER_NAME,
            actionDate: today,
          },
          {
            actionType: "finding_requested",
            status: "follow_up",
            approvalStatus: "none",
            note: "보완 요청 등록",
            actorName: DEFAULT_INSPECTOR_NAME,
            actionDate: today,
          },
          {
            actionType: "approval_requested",
            status: "follow_up",
            approvalStatus: "requested",
            note: "보완 후 승인 요청 대기",
            actorName: DEFAULT_INSPECTOR_NAME,
            actionDate: today,
          },
        ],
      },
      label: inspectionNo,
      counterKey: "handover",
    });

    void materialPass;
  }

  console.log(`\n완료: ${formatCounterSummary(globalCounters)}, dryRun=${DRY_RUN}`);
  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error("[seed-qc-module] 실패", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});

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
const DEFAULT_MEMBER_ID = "seed-qa-manager";
const DEFAULT_MEMBER_NAME = "QA 관리자";

type SeedCounters = {
  created: number;
  reused: number;
  updated: number;
};

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const [
    { connectDB },
    { default: Site },
    { default: QaPolicyGoal },
    { default: QaAssurancePlan },
    { default: QaProcedure },
    { default: QaAudit },
    { default: QaCapa },
    { default: QaPartnerAssurance },
    { default: QaKpiDefinition },
    qaPartnerModule,
    qaKpiModule,
  ] = await Promise.all([
    import("../src/lib/db"),
    import("../src/models/Site"),
    import("../src/models/QaPolicyGoal"),
    import("../src/models/QaAssurancePlan"),
    import("../src/models/QaProcedure"),
    import("../src/models/QaAudit"),
    import("../src/models/QaCapa"),
    import("../src/models/QaPartnerAssurance"),
    import("../src/models/QaKpiDefinition"),
    import("../src/lib/qa-partner-assurance"),
    import("../src/lib/qa-kpi"),
  ]);

  const { QA_PARTNER_DEFAULT_CRITERIA, getQaPartnerGrade, getQaPartnerRiskLevel, needsQaPartnerFollowUp } =
    qaPartnerModule;
  const { getDefaultQaKpiDirection, getDefaultQaKpiUnit, mapPolicyGoalCycleToQaKpiCycle } = qaKpiModule;

  await connectDB();

  const sites = await Site.find({ isDeleted: false })
    .select({ siteCode: 1, siteName: 1 })
    .sort({ createdAt: 1 });

  if (sites.length === 0) {
    console.log("현장이 없어 QA seed를 등록하지 않았습니다.");
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const counters: SeedCounters = {
    created: 0,
    reused: 0,
    updated: 0,
  };

  for (const site of sites) {
    const siteId = String(site._id);
    const siteLabel = `${String(site.siteCode ?? "")} ${String(site.siteName ?? "")}`.trim() || siteId;
    console.log(`\n[site] ${siteLabel}`);

    const samplePolicyTitle = `${year} 현장 품질방침`;
    let policyGoal = await QaPolicyGoal.findOne({ siteId, year }).sort({ revisionNo: -1, createdAt: -1 });
    if (!policyGoal) {
      const payload = {
        siteId,
        year,
        status: "approved",
        policyTitle: samplePolicyTitle,
        policyStatement: `${site.siteName} 품질 사고 제로와 재작업 최소화를 위한 현장 품질 기준 준수`,
        effectiveDate: new Date(`${year}-01-01`),
        revisionNo: 1,
        goals: [
          {
            goalId: `QA-GOAL-${year}-01`,
            title: "철근/거푸집 검측 부적합 최소화",
            metricName: "부적합 건수",
            unit: "건",
            targetValue: "2",
            measurementCycle: "monthly",
            ownerName: DEFAULT_MEMBER_NAME,
            ownerMemberId: DEFAULT_MEMBER_ID,
            note: "월간 내부 심사 기준",
          },
          {
            goalId: `QA-GOAL-${year}-02`,
            title: "CAPA 기한 준수",
            metricName: "기한 경과 CAPA",
            unit: "건",
            targetValue: "0",
            measurementCycle: "monthly",
            ownerName: DEFAULT_MEMBER_NAME,
            ownerMemberId: DEFAULT_MEMBER_ID,
            note: "기한 내 검증 완료 기준",
          },
        ],
      };
      if (DRY_RUN) {
        console.log(`  [create] QaPolicyGoal ${samplePolicyTitle}`);
        policyGoal = new QaPolicyGoal(payload);
      } else {
        policyGoal = await QaPolicyGoal.create(payload);
      }
      counters.created += 1;
    } else {
      counters.reused += 1;
      console.log(`  [reuse] QaPolicyGoal ${policyGoal.policyTitle}`);
    }

    const samplePlanTitle = `${year} 품질보증계획`;
    let assurancePlan = await QaAssurancePlan.findOne({ siteId, year, planTitle: samplePlanTitle }).sort({
      versionNo: -1,
      createdAt: -1,
    });
    if (!assurancePlan) {
      const payload = {
        siteId,
        year,
        versionNo: 1,
        status: "approved",
        planTitle: samplePlanTitle,
        revisionReason: "QA 샘플 데이터 초기화",
        linkedPolicyGoalId: String(policyGoal._id),
        linkedPolicyGoalTitle: policyGoal.policyTitle,
        linkedPolicyGoalYear: policyGoal.year,
        linkedPolicyGoalRevisionNo: policyGoal.revisionNo,
        scopeSummary: "철근콘크리트 골조 공정 품질관리 기준",
        qualityObjectiveSummary: "핵심 구조 공정의 선행 점검 및 검측 적합률 확보",
        templateReference: "QA-QAP-TPL-001",
        checkpoints: [
          {
            checkpointId: `QAP-${year}-01`,
            phaseName: "골조공사",
            checkpointTitle: "철근 배근 상태 사전점검",
            inspectionMethod: "체크리스트 현장 확인",
            acceptanceCriteria: "도면 및 시방 기준 적합",
            referenceProcedure: "QA-SOP-001",
            ownerName: DEFAULT_MEMBER_NAME,
            ownerMemberId: DEFAULT_MEMBER_ID,
            status: "planned",
          },
          {
            checkpointId: `QAP-${year}-02`,
            phaseName: "골조공사",
            checkpointTitle: "거푸집 설치 상태 점검",
            inspectionMethod: "체크리스트 및 치수 확인",
            acceptanceCriteria: "수직도, 치수, 거푸집 상태 적합",
            referenceProcedure: "QA-SOP-001",
            ownerName: DEFAULT_MEMBER_NAME,
            ownerMemberId: DEFAULT_MEMBER_ID,
            status: "in_progress",
          },
        ],
      };
      if (DRY_RUN) {
        console.log(`  [create] QaAssurancePlan ${samplePlanTitle}`);
        assurancePlan = new QaAssurancePlan(payload);
      } else {
        assurancePlan = await QaAssurancePlan.create(payload);
      }
      counters.created += 1;
    } else {
      counters.reused += 1;
      console.log(`  [reuse] QaAssurancePlan ${assurancePlan.planTitle}`);
    }

    const sampleProcedureKey = "QA-SOP-001";
    let procedure = await QaProcedure.findOne({ siteId, documentKey: sampleProcedureKey }).sort({
      versionNo: -1,
      createdAt: -1,
    });
    if (!procedure) {
      const payload = {
        siteId,
        documentKey: sampleProcedureKey,
        categoryCode: "SOP",
        documentType: "procedure",
        title: "철근콘크리트 공정 품질 점검 절차",
        summary: "철근, 거푸집, 콘크리트 타설 전 필수 확인 항목을 정의한다.",
        scopeType: "common",
        scopeSummary: `${site.siteName} 골조 공정 전 구간 적용`,
        versionNo: 1,
        effectiveDate: new Date(`${year}-01-15`),
        status: "active",
        retiredAt: null,
        isSiteRequired: true,
        referenceTargets: ["qap", "audit"],
        externalDocUrl: "https://example.com/pmis/qa/sop/qa-sop-001",
        fileAssetId: null,
        fileName: "",
        authorName: DEFAULT_MEMBER_NAME,
      };
      if (DRY_RUN) {
        console.log(`  [create] QaProcedure ${sampleProcedureKey}`);
        procedure = new QaProcedure(payload);
      } else {
        procedure = await QaProcedure.create(payload);
      }
      counters.created += 1;
    } else {
      counters.reused += 1;
      console.log(`  [reuse] QaProcedure ${procedure.documentKey}`);
    }

    const sampleAuditTitle = `${year} 1차 내부 품질 심사`;
    let audit = await QaAudit.findOne({ siteId, auditTitle: sampleAuditTitle }).sort({ plannedDate: -1 });
    if (!audit) {
      const plannedDate = new Date(`${year}-02-15`);
      const actualDate = new Date(`${year}-02-16`);
      const payload = {
        siteId,
        auditTitle: sampleAuditTitle,
        auditType: "regular",
        status: "completed",
        plannedDate,
        actualDate,
        auditeeName: site.siteName,
        scopeSummary: "골조공사 초기 품질 심사",
        auditLeadName: DEFAULT_MEMBER_NAME,
        auditLeadMemberId: DEFAULT_MEMBER_ID,
        linkedAssurancePlanId: String(assurancePlan._id),
        linkedAssurancePlanTitle: assurancePlan.planTitle,
        linkedAssurancePlanYear: assurancePlan.year,
        linkedAssurancePlanVersionNo: assurancePlan.versionNo,
        referencedProcedures: [
          {
            procedureId: String(procedure._id),
            documentKey: procedure.documentKey,
            title: procedure.title,
            versionNo: procedure.versionNo,
          },
        ],
        checklistItems: [
          {
            checklistId: `AUDIT-${year}-01`,
            sectionTitle: "철근 검측",
            itemTitle: "철근 배근 상태 점검",
            criteria: "도면 및 시방 기준 적합",
            result: "conformity",
            note: "주근 및 띠철근 간격 적합",
            requiresCapa: false,
            linkedCapaId: "",
          },
          {
            checklistId: `AUDIT-${year}-02`,
            sectionTitle: "거푸집 검측",
            itemTitle: "거푸집 수직도 및 누락 부재 점검",
            criteria: "수직도 기준 및 체결 상태 적합",
            result: "nonconformity",
            note: "체결 누락 구간 발견, 재점검 필요",
            requiresCapa: true,
            linkedCapaId: "",
          },
        ],
        resultSummary: "거푸집 체결 누락 1건에 대해 시정조치가 필요합니다.",
        nonconformityCount: 1,
        observationCount: 0,
        capaRequestedCount: 1,
      };
      if (DRY_RUN) {
        console.log(`  [create] QaAudit ${sampleAuditTitle}`);
        audit = new QaAudit(payload);
      } else {
        audit = await QaAudit.create(payload);
      }
      counters.created += 1;
    } else {
      counters.reused += 1;
      console.log(`  [reuse] QaAudit ${audit.auditTitle}`);
    }

    const sampleCapaTitle = "거푸집 체결 누락 재발 방지 조치";
    let capa = await QaCapa.findOne({ siteId, title: sampleCapaTitle }).sort({ createdAt: -1 });
    if (!capa) {
      const dueDate = new Date(`${year}-03-05`);
      const payload = {
        siteId,
        title: sampleCapaTitle,
        sourceType: "audit",
        sourceSummary: audit.auditTitle,
        sourceAuditId: String(audit._id),
        sourceAuditTitle: audit.auditTitle,
        sourceChecklistId: `AUDIT-${year}-02`,
        sourceChecklistSection: "거푸집 검측",
        sourceChecklistTitle: "거푸집 수직도 및 누락 부재 점검",
        actionType: "corrective",
        priority: "high",
        status: "in_progress",
        rootCauseSummary: "체결 전 체크리스트 이행 누락",
        whyAnalysis: [
          "체결 전 확인표 배포가 늦어졌다.",
          "반장 교대 시 인수인계가 빠졌다.",
          "검측 전 자체 점검 책임 구간이 불명확했다.",
          "점검 결과 공유가 구두로만 진행됐다.",
          "작업 전 검측 준비 회의가 누락됐다.",
        ],
        actionPlan: "거푸집 체결 체크리스트 재배포 및 반장 승인 절차 추가",
        executionNote: "현장 반장 교육 후 체크리스트 재적용",
        assigneeName: DEFAULT_MEMBER_NAME,
        assigneeMemberId: DEFAULT_MEMBER_ID,
        verifierName: "품질 책임자",
        verifierMemberId: "seed-qa-verifier",
        dueDate,
        verifiedAt: null,
        verificationNote: "",
      };
      if (DRY_RUN) {
        console.log(`  [create] QaCapa ${sampleCapaTitle}`);
        capa = new QaCapa(payload);
      } else {
        capa = await QaCapa.create(payload);
      }
      counters.created += 1;
    } else {
      counters.reused += 1;
      console.log(`  [reuse] QaCapa ${capa.title}`);
    }

    const checklistWithCapa = audit.checklistItems.find((item) => item.requiresCapa);
    if (checklistWithCapa && checklistWithCapa.linkedCapaId !== String(capa._id)) {
      if (DRY_RUN) {
        console.log(`  [update] QaAudit ${audit.auditTitle} linkedCapaId -> ${String(capa._id)}`);
      } else {
        checklistWithCapa.linkedCapaId = String(capa._id);
        await audit.save();
      }
      counters.updated += 1;
    }

    const samplePartnerName = "샘플 협력업체";
    let partnerAssurance = await QaPartnerAssurance.findOne({ siteId, partnerName: samplePartnerName }).sort({
      evaluationDate: -1,
    });
    if (!partnerAssurance) {
      const assessmentItems = QA_PARTNER_DEFAULT_CRITERIA.map((item, index) => ({
        itemId: `PARTNER-${year}-${String(index + 1).padStart(2, "0")}`,
        criterionCategory: item.criterionCategory,
        criterionTitle: item.criterionTitle,
        maxScore: item.maxScore,
        score: [23, 22, 19, 18][index] ?? item.maxScore,
        comment: index >= 2 ? "개선 요청 필요" : "기준 충족",
        requiresImprovement: index >= 2,
      }));
      const totalScore = assessmentItems.reduce((sum, item) => sum + item.score, 0);
      const maxScore = assessmentItems.reduce((sum, item) => sum + item.maxScore, 0);
      const improvementCount = assessmentItems.filter((item) => item.requiresImprovement).length;
      const grade = getQaPartnerGrade(totalScore, maxScore);
      const followUpStatus = needsQaPartnerFollowUp(grade, improvementCount) ? "requested" : "not_required";
      const riskLevel = getQaPartnerRiskLevel(grade, improvementCount, followUpStatus);

      const payload = {
        siteId,
        partnerCode: "PARTNER-SEED-001",
        partnerName: samplePartnerName,
        partnerSource: "manual",
        partnerCategory: "subcontractor",
        evaluationType: "regular",
        status: "follow_up",
        evaluationDate: new Date(`${year}-02-20`),
        nextReviewDate: new Date(`${year}-05-20`),
        evaluatorName: DEFAULT_MEMBER_NAME,
        evaluatorMemberId: DEFAULT_MEMBER_ID,
        contactName: "현장소장",
        contactPhone: "010-0000-0000",
        scopeSummary: "골조 협력업체 정기 품질 평가",
        summary: "문서 대응과 이슈 대응 항목에 개선 요청이 필요합니다.",
        improvementRequest: "출하 전 서류 제출 시점과 이슈 회신 SLA를 개선합니다.",
        followUpStatus,
        linkedCapaId: String(capa._id),
        assessmentItems,
        totalScore,
        maxScore,
        grade,
        riskLevel,
      };
      if (DRY_RUN) {
        console.log(`  [create] QaPartnerAssurance ${samplePartnerName}`);
        partnerAssurance = new QaPartnerAssurance(payload);
      } else {
        partnerAssurance = await QaPartnerAssurance.create(payload);
      }
      counters.created += 1;
    } else {
      counters.reused += 1;
      console.log(`  [reuse] QaPartnerAssurance ${partnerAssurance.partnerName}`);
    }

    const kpiMetricCode = `QA-KPI-${year}-001`;
    let kpi = await QaKpiDefinition.findOne({ siteId, metricCode: kpiMetricCode });
    if (!kpi) {
      const primaryGoal = policyGoal.goals[1] ?? policyGoal.goals[0];
      const sourceMetric = "capa_overdue_count";
      const payload = {
        siteId,
        metricCode: kpiMetricCode,
        metricName: "기한 경과 CAPA 관리",
        sourceMetric,
        measurementCycle: mapPolicyGoalCycleToQaKpiCycle(primaryGoal?.measurementCycle ?? "monthly"),
        unit: getDefaultQaKpiUnit(sourceMetric),
        targetDirection: getDefaultQaKpiDirection(sourceMetric),
        targetValue: 0,
        warningThreshold: 1,
        linkedPolicyGoalId: String(policyGoal._id),
        linkedPolicyGoalYear: policyGoal.year,
        linkedPolicyGoalTitle: policyGoal.policyTitle,
        linkedPolicyGoalGoalId: primaryGoal?.goalId ?? "",
        linkedPolicyGoalMetricName: primaryGoal?.metricName ?? "",
        ownerName: primaryGoal?.ownerName || DEFAULT_MEMBER_NAME,
        ownerMemberId: primaryGoal?.ownerMemberId || DEFAULT_MEMBER_ID,
        description: "CAPA 기한 경과 건수를 월간 기준으로 모니터링한다.",
        isActive: true,
      };
      if (DRY_RUN) {
        console.log(`  [create] QaKpiDefinition ${kpiMetricCode}`);
        kpi = new QaKpiDefinition(payload);
      } else {
        kpi = await QaKpiDefinition.create(payload);
      }
      counters.created += 1;
    } else {
      counters.reused += 1;
      console.log(`  [reuse] QaKpiDefinition ${kpi.metricCode}`);
    }

    console.log(`  [done] ${formatDateKey(now)} 기준 QA seed 점검 완료`);
  }

  console.log("");
  console.log(
    `${DRY_RUN ? "DRY RUN " : ""}완료: 생성 ${counters.created}건, 재사용 ${counters.reused}건, 갱신 ${counters.updated}건`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

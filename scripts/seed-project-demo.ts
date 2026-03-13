import { spawn } from "node:child_process";
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
const PLAN_ONLY = process.argv.includes("--plan");
const INCLUDE_QA = !process.argv.includes("--skip-qa");
const INCLUDE_QC = !process.argv.includes("--skip-qc");
const INCLUDE_CODE_MASTERS = !process.argv.includes("--skip-code-masters");

type ModelKey =
  | "users"
  | "sites"
  | "memberships"
  | "personnel"
  | "notices"
  | "meetings"
  | "issues"
  | "history"
  | "visitors"
  | "calendar"
  | "schedule"
  | "materials"
  | "equipment"
  | "supplierApprovals"
  | "subcontractReviews"
  | "documents"
  | "drawings"
  | "designChanges"
  | "resources";

type CounterEntry = {
  created: number;
  reused: number;
  updated: number;
};

type CounterMap = Record<ModelKey, CounterEntry>;

type DemoSiteBlueprint = {
  siteCode: string;
  siteName: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  startOffsetDays: number;
};

type DemoUserBlueprint = {
  email: string;
  name: string;
  role: "super_admin" | "site_admin" | "manager" | "viewer";
};

type DemoSiteMember = {
  email: string;
  membershipRole: "site_admin" | "manager" | "viewer";
  category: "constructor" | "partner" | "government";
  company: string;
  position: string;
  roleLabel: string;
  phone: string;
};

type DemoSiteContext = {
  site: mongoose.Document & {
    _id: mongoose.Types.ObjectId;
    siteCode: string;
    siteName: string;
  };
  members: Record<string, mongoose.Document & { _id: mongoose.Types.ObjectId; name: string; email: string }>;
};

const SITE_BLUEPRINTS: readonly DemoSiteBlueprint[] = [
  {
    siteCode: "DEMO-SEOUL-01",
    siteName: "PMIS 데모 현장 서울",
    address: "서울특별시 강동구 샘플로 101",
    latitude: 37.5563,
    longitude: 127.1542,
    description: "도심 업무시설 신축 데모 현장",
    startOffsetDays: -120,
  },
  {
    siteCode: "DEMO-BUSAN-02",
    siteName: "PMIS 데모 현장 부산",
    address: "부산광역시 해운대구 샘플로 202",
    latitude: 35.1709,
    longitude: 129.1357,
    description: "주상복합 리모델링 데모 현장",
    startOffsetDays: -80,
  },
] as const;

const USER_BLUEPRINTS: readonly DemoUserBlueprint[] = [
  { email: "admin@autobotlog.local", name: "오토봇 관리자", role: "super_admin" },
  { email: "seoul.admin@autobotlog.local", name: "김현장", role: "site_admin" },
  { email: "seoul.pm@autobotlog.local", name: "이공정", role: "manager" },
  { email: "seoul.qa@autobotlog.local", name: "박품질", role: "manager" },
  { email: "seoul.viewer@autobotlog.local", name: "최지원", role: "viewer" },
  { email: "busan.admin@autobotlog.local", name: "정현장", role: "site_admin" },
  { email: "busan.pm@autobotlog.local", name: "한공정", role: "manager" },
  { email: "busan.qa@autobotlog.local", name: "윤품질", role: "manager" },
  { email: "busan.viewer@autobotlog.local", name: "오지원", role: "viewer" },
] as const;

const SITE_MEMBER_BLUEPRINTS: Readonly<Record<string, readonly DemoSiteMember[]>> = {
  "DEMO-SEOUL-01": [
    {
      email: "seoul.admin@autobotlog.local",
      membershipRole: "site_admin",
      category: "constructor",
      company: "오토봇건설",
      position: "현장소장",
      roleLabel: "총괄",
      phone: "010-1100-1101",
    },
    {
      email: "seoul.pm@autobotlog.local",
      membershipRole: "manager",
      category: "constructor",
      company: "오토봇건설",
      position: "공무차장",
      roleLabel: "공정/문서",
      phone: "010-1100-1102",
    },
    {
      email: "seoul.qa@autobotlog.local",
      membershipRole: "manager",
      category: "constructor",
      company: "오토봇건설",
      position: "품질차장",
      roleLabel: "QA/QC",
      phone: "010-1100-1103",
    },
    {
      email: "seoul.viewer@autobotlog.local",
      membershipRole: "viewer",
      category: "partner",
      company: "서울파트너건설",
      position: "협력사 대리",
      roleLabel: "협력사",
      phone: "010-1100-1104",
    },
  ],
  "DEMO-BUSAN-02": [
    {
      email: "busan.admin@autobotlog.local",
      membershipRole: "site_admin",
      category: "constructor",
      company: "오토봇건설",
      position: "현장소장",
      roleLabel: "총괄",
      phone: "010-2200-2201",
    },
    {
      email: "busan.pm@autobotlog.local",
      membershipRole: "manager",
      category: "constructor",
      company: "오토봇건설",
      position: "공무차장",
      roleLabel: "공정/문서",
      phone: "010-2200-2202",
    },
    {
      email: "busan.qa@autobotlog.local",
      membershipRole: "manager",
      category: "constructor",
      company: "오토봇건설",
      position: "품질차장",
      roleLabel: "QA/QC",
      phone: "010-2200-2203",
    },
    {
      email: "busan.viewer@autobotlog.local",
      membershipRole: "viewer",
      category: "government",
      company: "해운대구청",
      position: "주무관",
      roleLabel: "발주처/관공서",
      phone: "010-2200-2204",
    },
  ],
} as const;

function createCounters(): CounterMap {
  return {
    users: { created: 0, reused: 0, updated: 0 },
    sites: { created: 0, reused: 0, updated: 0 },
    memberships: { created: 0, reused: 0, updated: 0 },
    personnel: { created: 0, reused: 0, updated: 0 },
    notices: { created: 0, reused: 0, updated: 0 },
    meetings: { created: 0, reused: 0, updated: 0 },
    issues: { created: 0, reused: 0, updated: 0 },
    history: { created: 0, reused: 0, updated: 0 },
    visitors: { created: 0, reused: 0, updated: 0 },
    calendar: { created: 0, reused: 0, updated: 0 },
    schedule: { created: 0, reused: 0, updated: 0 },
    materials: { created: 0, reused: 0, updated: 0 },
    equipment: { created: 0, reused: 0, updated: 0 },
    supplierApprovals: { created: 0, reused: 0, updated: 0 },
    subcontractReviews: { created: 0, reused: 0, updated: 0 },
    documents: { created: 0, reused: 0, updated: 0 },
    drawings: { created: 0, reused: 0, updated: 0 },
    designChanges: { created: 0, reused: 0, updated: 0 },
    resources: { created: 0, reused: 0, updated: 0 },
  };
}

const counters = createCounters();

function recordCounter(modelKey: ModelKey, action: keyof CounterEntry) {
  counters[modelKey][action] += 1;
}

function formatCounters() {
  return Object.entries(counters)
    .map(([key, value]) => `${key}(created=${value.created}, reused=${value.reused}, updated=${value.updated})`)
    .join(", ");
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function withTime(date: Date, hours: number, minutes = 0) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function formatDatePart(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function buildDocumentNo(date: Date, sequence: number) {
  return `DOC-${formatDatePart(date)}-${String(sequence).padStart(5, "0")}`;
}

function normalizeComparable(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparable(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeComparable((value as Record<string, unknown>)[key]);
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
  modelKey,
}: {
  model: mongoose.Model<T>;
  filter: Record<string, unknown>;
  values: Record<string, unknown>;
  label: string;
  modelKey: ModelKey;
}) {
  const existing = await model.findOne(filter);

  if (!existing) {
    console.log(`  [create][${modelKey}] ${label}`);
    recordCounter(modelKey, "created");

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
    console.log(`  [reuse][${modelKey}] ${label}`);
    recordCounter(modelKey, "reused");
    return existing;
  }

  console.log(`  [update][${modelKey}] ${label}`);
  recordCounter(modelKey, "updated");

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

function logPlan() {
  console.log("PMIS project demo seed plan");
  console.log("");
  console.log(`- demo sites: ${SITE_BLUEPRINTS.map((site) => site.siteCode).join(", ")}`);
  console.log("- baseline: users, sites, memberships, site personnel");
  console.log("- dashboard/core: notices, meetings, issues, history, visitors");
  console.log("- progress/procurement: calendar, schedule, material/equipment, supplier approvals, subcontract reviews");
  console.log("- design/docs: documents, drawings, design changes, resource library");
  console.log(`- workforce code masters: ${INCLUDE_CODE_MASTERS ? "enabled" : "skipped"}`);
  console.log(`- QA module seeds: ${INCLUDE_QA ? "enabled" : "skipped"}`);
  console.log(`- QC module seeds: ${INCLUDE_QC ? "enabled" : "skipped"}`);
  console.log(`- execution mode: ${DRY_RUN ? "dry-run" : "write"}`);
}

async function runChildSeed(scriptName: string, siteCodes: string[]) {
  const args = ["tsx", path.join("scripts", scriptName)];
  if (DRY_RUN) {
    args.push("--dry-run");
  }
  args.push(`--site-codes=${siteCodes.join(",")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${scriptName} exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

async function main() {
  if (PLAN_ONLY) {
    logPlan();
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI가 없어 프로젝트 더미데이터를 준비할 수 없습니다.");
  }

  const [
    { connectDB },
    { default: User },
    { default: Site },
    { default: SiteMembership },
    { default: SitePersonnel },
    { default: Notice },
    { default: Meeting },
    { default: Issue },
    { default: SiteHistory },
    { default: VisitorLog },
    { default: ProjectCalendarEvent },
    { default: ScheduleItem },
    { default: MaterialPlanActual },
    { default: EquipmentPlanActual },
    { default: SupplierApprovalRequest },
    { default: SubcontractReview },
    { default: DocumentModel },
    { default: Drawing },
    { default: DesignChange },
    { default: ResourceLibraryItem },
  ] = await Promise.all([
    import("../src/lib/db"),
    import("../src/models/User"),
    import("../src/models/Site"),
    import("../src/models/SiteMembership"),
    import("../src/models/SitePersonnel"),
    import("../src/models/Notice"),
    import("../src/models/Meeting"),
    import("../src/models/Issue"),
    import("../src/models/SiteHistory"),
    import("../src/models/VisitorLog"),
    import("../src/models/ProjectCalendarEvent"),
    import("../src/models/ScheduleItem"),
    import("../src/models/MaterialPlanActual"),
    import("../src/models/EquipmentPlanActual"),
    import("../src/models/SupplierApprovalRequest"),
    import("../src/models/SubcontractReview"),
    import("../src/models/Document"),
    import("../src/models/Drawing"),
    import("../src/models/DesignChange"),
    import("../src/models/ResourceLibraryItem"),
  ]);

  await connectDB();

  const today = startOfDay(new Date());
  const demoUsers = new Map<string, mongoose.Document & { _id: mongoose.Types.ObjectId; name: string; email: string }>();

  for (const userBlueprint of USER_BLUEPRINTS) {
    const user = await upsertSeedDocument({
      model: User,
      filter: { email: userBlueprint.email },
      values: {
        name: userBlueprint.name,
        email: userBlueprint.email,
        role: userBlueprint.role,
        provider: "seed",
        providerId: `seed:${userBlueprint.email}`,
        isActive: true,
        lastLoginAt: today,
      },
      label: userBlueprint.email,
      modelKey: "users",
    });

    demoUsers.set(userBlueprint.email, user as mongoose.Document & { _id: mongoose.Types.ObjectId; name: string; email: string });
  }

  const siteContexts: DemoSiteContext[] = [];

  for (const siteBlueprint of SITE_BLUEPRINTS) {
    const siteAdminEmail =
      siteBlueprint.siteCode === "DEMO-SEOUL-01" ? "seoul.admin@autobotlog.local" : "busan.admin@autobotlog.local";
    const projectManager = demoUsers.get(siteAdminEmail);
    if (!projectManager) {
      throw new Error(`${siteBlueprint.siteCode} project manager 계정을 찾을 수 없습니다.`);
    }

    const site = await upsertSeedDocument({
      model: Site,
      filter: { siteCode: siteBlueprint.siteCode },
      values: {
        siteCode: siteBlueprint.siteCode,
        siteName: siteBlueprint.siteName,
        address: siteBlueprint.address,
        latitude: siteBlueprint.latitude,
        longitude: siteBlueprint.longitude,
        status: "active",
        startDate: addDays(today, siteBlueprint.startOffsetDays),
        description: siteBlueprint.description,
        projectManager: projectManager._id,
      },
      label: siteBlueprint.siteCode,
      modelKey: "sites",
    });

    const members: DemoSiteContext["members"] = {};

    for (const memberBlueprint of SITE_MEMBER_BLUEPRINTS[siteBlueprint.siteCode] ?? []) {
      const user = demoUsers.get(memberBlueprint.email);
      if (!user) {
        throw new Error(`${siteBlueprint.siteCode}의 사용자 ${memberBlueprint.email}를 찾을 수 없습니다.`);
      }

      await upsertSeedDocument({
        model: SiteMembership,
        filter: { siteId: site._id, userId: user._id },
        values: {
          siteId: site._id,
          userId: user._id,
          role: memberBlueprint.membershipRole,
          assignedAt: addDays(today, siteBlueprint.startOffsetDays),
          isActive: true,
          revokedAt: null,
        },
        label: `${siteBlueprint.siteCode}:${user.email}`,
        modelKey: "memberships",
      });

      await upsertSeedDocument({
        model: SitePersonnel,
        filter: { siteId: site._id, email: user.email },
        values: {
          siteId: site._id,
          userId: user._id,
          category: memberBlueprint.category,
          name: user.name,
          company: memberBlueprint.company,
          position: memberBlueprint.position,
          role: memberBlueprint.roleLabel,
          phone: memberBlueprint.phone,
          email: user.email,
          startDate: addDays(today, siteBlueprint.startOffsetDays),
          endDate: null,
          isActive: true,
        },
        label: `${siteBlueprint.siteCode}:${user.name}`,
        modelKey: "personnel",
      });

      members[user.email] = user;
    }

    siteContexts.push({
      site: site as mongoose.Document & { _id: mongoose.Types.ObjectId; siteCode: string; siteName: string },
      members,
    });
  }

  for (const context of siteContexts) {
    const { site, members } = context;
    const siteCode = String(site.siteCode);
    const siteLabel = `${site.siteCode} ${site.siteName}`;
    const siteLead =
      members[siteCode === "DEMO-SEOUL-01" ? "seoul.admin@autobotlog.local" : "busan.admin@autobotlog.local"];
    const pm = members[siteCode === "DEMO-SEOUL-01" ? "seoul.pm@autobotlog.local" : "busan.pm@autobotlog.local"];
    const qa = members[siteCode === "DEMO-SEOUL-01" ? "seoul.qa@autobotlog.local" : "busan.qa@autobotlog.local"];
    const reviewer =
      members[siteCode === "DEMO-SEOUL-01" ? "seoul.viewer@autobotlog.local" : "busan.viewer@autobotlog.local"];

    if (!siteLead || !pm || !qa || !reviewer) {
      throw new Error(`${siteCode} 멤버 구성 데이터가 올바르지 않습니다.`);
    }

    console.log(`\n[site] ${siteLabel}`);

    const kickoffDate = addDays(today, -14);
    const coordinationDate = addDays(today, -1);
    const todayMeetingDate = today;
    const futureMeetingDate = addDays(today, 2);
    const documentBaseDate = addDays(today, -2);

    await upsertSeedDocument({
      model: Notice,
      filter: { siteId: site._id, title: `${site.siteName} 주간 공지` },
      values: {
        siteId: site._id,
        title: `${site.siteName} 주간 공지`,
        content: "이번 주 주요 일정, 출입 통제 변경, 품질 점검 계획을 공유합니다.",
        authorName: siteLead.name,
        isPinned: true,
        postedAt: addDays(today, -1),
      },
      label: `${siteCode}:notice:weekly`,
      modelKey: "notices",
    });

    await upsertSeedDocument({
      model: Notice,
      filter: { siteId: site._id, title: `${site.siteName} 협력사 제출 안내` },
      values: {
        siteId: site._id,
        title: `${site.siteName} 협력사 제출 안내`,
        content: "다음 주 자재 승인 요청 및 시험 성적서 제출 마감은 금요일 15시입니다.",
        authorName: qa.name,
        isPinned: false,
        postedAt: addDays(today, -3),
      },
      label: `${siteCode}:notice:supplier`,
      modelKey: "notices",
    });

    await upsertSeedDocument({
      model: Meeting,
      filter: { siteId: site._id, agenda: `${site.siteName} 일일 공정 회의` },
      values: {
        siteId: site._id,
        category: "공정",
        agenda: `${site.siteName} 일일 공정 회의`,
        meetingDate: todayMeetingDate,
        startTime: "08:30",
        endTime: "09:00",
        location: "현장 회의실",
        host: pm.name,
        notice: "골조/마감 간섭 사항 공유",
        minutes: "자재 반입 일정 조정 및 NCR 후속조치 확인",
        minutesUpdatedAt: withTime(todayMeetingDate, 9, 10),
      },
      label: `${siteCode}:meeting:daily`,
      modelKey: "meetings",
    });

    await upsertSeedDocument({
      model: Meeting,
      filter: { siteId: site._id, agenda: `${site.siteName} 협력사 정례 회의` },
      values: {
        siteId: site._id,
        category: "협력사",
        agenda: `${site.siteName} 협력사 정례 회의`,
        meetingDate: futureMeetingDate,
        startTime: "14:00",
        endTime: "15:00",
        location: "협력사 회의실",
        host: siteLead.name,
        notice: "품질 서류 제출과 공정 간섭 사항 점검",
        minutes: "",
        minutesUpdatedAt: null,
      },
      label: `${siteCode}:meeting:partner`,
      modelKey: "meetings",
    });

    await upsertSeedDocument({
      model: Issue,
      filter: { siteId: site._id, title: `${site.siteName} 오픈 이슈` },
      values: {
        siteId: site._id,
        title: `${site.siteName} 오픈 이슈`,
        content: "주차장 천장 배관 간섭 검토가 지연되고 있어 설계/시공 협의가 필요합니다.",
        authorName: pm.name,
        viewCount: 12,
        status: "open",
      },
      label: `${siteCode}:issue:open`,
      modelKey: "issues",
    });

    await upsertSeedDocument({
      model: Issue,
      filter: { siteId: site._id, title: `${site.siteName} 해결 이슈` },
      values: {
        siteId: site._id,
        title: `${site.siteName} 해결 이슈`,
        content: "엘리베이터 홀 바닥 레벨 오차는 재시공 후 종결되었습니다.",
        authorName: qa.name,
        viewCount: 7,
        status: "closed",
      },
      label: `${siteCode}:issue:closed`,
      modelKey: "issues",
    });

    await upsertSeedDocument({
      model: SiteHistory,
      filter: { siteId: site._id, title: "착공 신고 완료" },
      values: {
        siteId: site._id,
        eventDate: kickoffDate,
        title: "착공 신고 완료",
        description: "착공 신고 및 초기 협력사 킥오프 회의를 완료했습니다.",
        category: "착공",
      },
      label: `${siteCode}:history:kickoff`,
      modelKey: "history",
    });

    await upsertSeedDocument({
      model: SiteHistory,
      filter: { siteId: site._id, title: "주간 품질 점검" },
      values: {
        siteId: site._id,
        eventDate: coordinationDate,
        title: "주간 품질 점검",
        description: "품질/공정 합동 점검을 완료하고 NCR 후속조치를 정리했습니다.",
        category: "점검",
      },
      label: `${siteCode}:history:quality`,
      modelKey: "history",
    });

    await upsertSeedDocument({
      model: VisitorLog,
      filter: { siteId: site._id, visitorName: "김협력", visitDate: todayMeetingDate },
      values: {
        siteId: site._id,
        visitorName: "김협력",
        company: "샘플전기",
        purpose: "전기 간섭 협의",
        visitDate: todayMeetingDate,
        checkInTime: "09:40",
        checkOutTime: "11:30",
        contactUserId: pm._id,
        contactPerson: pm.name,
        phone: "010-3333-3333",
        vehicleNo: "12가3456",
        remarks: "회의실 출입 완료",
      },
      label: `${siteCode}:visitor:1`,
      modelKey: "visitors",
    });

    await upsertSeedDocument({
      model: VisitorLog,
      filter: { siteId: site._id, visitorName: "박감리", visitDate: addDays(today, -1) },
      values: {
        siteId: site._id,
        visitorName: "박감리",
        company: "감리법인 샘플",
        purpose: "주간 검측 확인",
        visitDate: addDays(today, -1),
        checkInTime: "13:00",
        checkOutTime: "15:20",
        contactUserId: qa._id,
        contactPerson: qa.name,
        phone: "010-4444-4444",
        vehicleNo: "34나7890",
        remarks: "QC 검사 사진 공유",
      },
      label: `${siteCode}:visitor:2`,
      modelKey: "visitors",
    });

    await upsertSeedDocument({
      model: ProjectCalendarEvent,
      filter: { siteId: site._id, title: "월간 발주 회의" },
      values: {
        siteId: site._id,
        title: "월간 발주 회의",
        category: "meeting",
        startDate: withTime(addDays(today, 3), 10, 0),
        endDate: withTime(addDays(today, 3), 11, 30),
        isAllDay: false,
        description: "주요 자재 발주, 공급원 승인, 시험 일정 조율",
        color: "#0f766e",
      },
      label: `${siteCode}:calendar:procurement`,
      modelKey: "calendar",
    });

    await upsertSeedDocument({
      model: ProjectCalendarEvent,
      filter: { siteId: site._id, title: "합동 안전/품질 점검" },
      values: {
        siteId: site._id,
        title: "합동 안전/품질 점검",
        category: "inspection",
        startDate: withTime(addDays(today, 1), 14, 0),
        endDate: withTime(addDays(today, 1), 16, 0),
        isAllDay: false,
        description: "품질 이슈와 위험 작업 구간 동시 점검",
        color: "#dc2626",
      },
      label: `${siteCode}:calendar:inspection`,
      modelKey: "calendar",
    });

    await upsertSeedDocument({
      model: ScheduleItem,
      filter: { siteId: site._id, taskCode: "COM-001" },
      values: {
        siteId: site._id,
        taskCode: "COM-001",
        taskName: "가설 울타리 및 동선 정리",
        category: "공통/가설",
        plannedStart: addDays(today, -30),
        plannedEnd: addDays(today, -20),
        actualStart: addDays(today, -30),
        actualEnd: addDays(today, -21),
        plannedProgress: 100,
        actualProgress: 100,
        parentTaskId: null,
        sortOrder: 1,
      },
      label: `${siteCode}:schedule:com-001`,
      modelKey: "schedule",
    });

    await upsertSeedDocument({
      model: ScheduleItem,
      filter: { siteId: site._id, taskCode: "STR-001" },
      values: {
        siteId: site._id,
        taskCode: "STR-001",
        taskName: "지상 3층 골조 시공",
        category: "골조",
        plannedStart: addDays(today, -10),
        plannedEnd: addDays(today, 7),
        actualStart: addDays(today, -9),
        actualEnd: null,
        plannedProgress: 70,
        actualProgress: 63,
        parentTaskId: null,
        sortOrder: 2,
      },
      label: `${siteCode}:schedule:str-001`,
      modelKey: "schedule",
    });

    await upsertSeedDocument({
      model: ScheduleItem,
      filter: { siteId: site._id, taskCode: "FIN-001" },
      values: {
        siteId: site._id,
        taskCode: "FIN-001",
        taskName: "기준층 석고보드 마감 준비",
        category: "마감",
        plannedStart: addDays(today, 10),
        plannedEnd: addDays(today, 24),
        actualStart: null,
        actualEnd: null,
        plannedProgress: 10,
        actualProgress: 0,
        parentTaskId: null,
        sortOrder: 3,
      },
      label: `${siteCode}:schedule:fin-001`,
      modelKey: "schedule",
    });

    await upsertSeedDocument({
      model: MaterialPlanActual,
      filter: { siteId: site._id, materialName: "레미콘 27-24-150" },
      values: {
        siteId: site._id,
        materialName: "레미콘 27-24-150",
        specification: "슬래브용",
        unit: "M3",
        planQty: 420,
        actualQty: 398,
        planDate: addDays(today, -2),
        actualDate: addDays(today, -2),
        supplier: "샘플레미콘",
        unitPrice: 91000,
        remarks: "다음 타설분 22m3 대기",
      },
      label: `${siteCode}:material:ready-mix`,
      modelKey: "materials",
    });

    await upsertSeedDocument({
      model: MaterialPlanActual,
      filter: { siteId: site._id, materialName: "철근 D16" },
      values: {
        siteId: site._id,
        materialName: "철근 D16",
        specification: "KS D 3504",
        unit: "TON",
        planQty: 68,
        actualQty: 71,
        planDate: addDays(today, -5),
        actualDate: addDays(today, -4),
        supplier: "샘플철강",
        unitPrice: 1050000,
        remarks: "현장 반입 완료",
      },
      label: `${siteCode}:material:rebar`,
      modelKey: "materials",
    });

    await upsertSeedDocument({
      model: EquipmentPlanActual,
      filter: { siteId: site._id, equipmentName: "25T 이동식 크레인" },
      values: {
        siteId: site._id,
        equipmentName: "25T 이동식 크레인",
        specification: "월 임차",
        unit: "대",
        planQty: 1,
        actualQty: 1,
        planDate: addDays(today, -12),
        actualDate: addDays(today, -12),
        rentalCompany: "샘플장비",
        unitPrice: 3200000,
        remarks: "골조 자재 양중 투입",
      },
      label: `${siteCode}:equipment:crane`,
      modelKey: "equipment",
    });

    await upsertSeedDocument({
      model: EquipmentPlanActual,
      filter: { siteId: site._id, equipmentName: "고소작업대" },
      values: {
        siteId: site._id,
        equipmentName: "고소작업대",
        specification: "14m",
        unit: "대",
        planQty: 2,
        actualQty: 2,
        planDate: addDays(today, -6),
        actualDate: addDays(today, -6),
        rentalCompany: "샘플렌탈",
        unitPrice: 780000,
        remarks: "전기/천장 작업 예정",
      },
      label: `${siteCode}:equipment:lift`,
      modelKey: "equipment",
    });

    await upsertSeedDocument({
      model: SupplierApprovalRequest,
      filter: { siteId: site._id, supplierName: "샘플레미콘", materialName: "레미콘 27-24-150" },
      values: {
        siteId: site._id,
        approvalType: "material",
        supplierName: "샘플레미콘",
        materialName: "레미콘 27-24-150",
        specification: "슬래브 콘크리트",
        manufacturer: "샘플레미콘 성수공장",
        requestDate: addDays(today, -7),
        requestedBy: pm._id,
        status: "approved",
        approvedAt: addDays(today, -5),
        approvedBy: siteLead._id,
        rejectionReason: "",
        fileAssetId: null,
        remarks: "시험 성적서 확인 완료",
      },
      label: `${siteCode}:supplier:concrete`,
      modelKey: "supplierApprovals",
    });

    await upsertSeedDocument({
      model: SupplierApprovalRequest,
      filter: { siteId: site._id, supplierName: "샘플도장", materialName: "내부 수성페인트" },
      values: {
        siteId: site._id,
        approvalType: "material",
        supplierName: "샘플도장",
        materialName: "내부 수성페인트",
        specification: "VOC 저감형",
        manufacturer: "샘플페인트",
        requestDate: addDays(today, -1),
        requestedBy: qa._id,
        status: "pending",
        approvedAt: null,
        approvedBy: null,
        rejectionReason: "",
        fileAssetId: null,
        remarks: "색상 샘플 승인 대기",
      },
      label: `${siteCode}:supplier:paint`,
      modelKey: "supplierApprovals",
    });

    await upsertSeedDocument({
      model: SubcontractReview,
      filter: { siteId: site._id, title: "마감공사 하도급 검토" },
      values: {
        siteId: site._id,
        title: "마감공사 하도급 검토",
        contractorName: "샘플마감건설",
        workType: "마감",
        contractAmount: 480000000,
        requestDate: addDays(today, -8),
        requestedBy: pm._id,
        status: "approved",
        approvedDate: addDays(today, -6),
        approvedBy: siteLead._id,
        rejectionReason: "",
        remarks: "공정 및 인력 계획 적합",
      },
      label: `${siteCode}:subcontract:finish`,
      modelKey: "subcontractReviews",
    });

    await upsertSeedDocument({
      model: SubcontractReview,
      filter: { siteId: site._id, title: "기계설비 공사 견적 검토" },
      values: {
        siteId: site._id,
        title: "기계설비 공사 견적 검토",
        contractorName: "샘플기계설비",
        workType: "기계설비",
        contractAmount: 530000000,
        requestDate: addDays(today, -2),
        requestedBy: siteLead._id,
        status: "pending",
        approvedDate: null,
        approvedBy: null,
        rejectionReason: "",
        remarks: "공기 단축안 검토 중",
      },
      label: `${siteCode}:subcontract:mechanical`,
      modelKey: "subcontractReviews",
    });

    const documents = [
      {
        docNo: buildDocumentNo(documentBaseDate, siteCode === "DEMO-SEOUL-01" ? 1 : 11),
        title: "협력사 자재 승인 요청서",
        content: "협력사 자재 승인 요청 및 시험성적서 검토 요청",
        ledgerType: "inbound",
        direction: "inbound",
        status: "in_review",
        categoryCode: "QA",
        senderName: reviewer.name,
        receiverName: siteLead.name,
        draftByName: pm.name,
        submittedAt: addDays(today, -2),
        sentAt: addDays(today, -2),
        receivedAt: addDays(today, -1),
        completedAt: null,
        currentApprovalOrder: 1,
        finalApproverName: siteLead.name,
      },
      {
        docNo: buildDocumentNo(addDays(today, -1), siteCode === "DEMO-SEOUL-01" ? 2 : 12),
        title: "주간 공정 보고서",
        content: "주간 공정 및 리스크 현황 보고",
        ledgerType: "general",
        direction: "internal",
        status: "approved",
        categoryCode: "PROGRESS",
        senderName: pm.name,
        receiverName: siteLead.name,
        draftByName: pm.name,
        submittedAt: addDays(today, -1),
        sentAt: addDays(today, -1),
        receivedAt: addDays(today, -1),
        completedAt: today,
        currentApprovalOrder: 2,
        finalApproverName: siteLead.name,
      },
      {
        docNo: buildDocumentNo(today, siteCode === "DEMO-SEOUL-01" ? 3 : 13),
        title: "설계변경 검토 요청",
        content: "현장 여건 반영 설계변경 검토 요청",
        ledgerType: "instruction",
        direction: "outbound",
        status: "draft",
        categoryCode: "DESIGN",
        senderName: siteLead.name,
        receiverName: "본사 설계팀",
        draftByName: qa.name,
        submittedAt: null,
        sentAt: null,
        receivedAt: null,
        completedAt: null,
        currentApprovalOrder: 0,
        finalApproverName: "본사 설계팀장",
      },
    ];

    for (const document of documents) {
      await upsertSeedDocument({
        model: DocumentModel,
        filter: { siteId: site._id, docNo: document.docNo },
        values: {
          siteId: site._id,
          ...document,
        },
        label: `${siteCode}:${document.docNo}`,
        modelKey: "documents",
      });
    }

    const mainDrawing = await upsertSeedDocument({
      model: Drawing,
      filter: { siteId: site._id, drawingNo: `${siteCode}-A-101` },
      values: {
        siteId: site._id,
        drawingNo: `${siteCode}-A-101`,
        drawingName: "기준층 평면도",
        discipline: "건축",
        location: "기준층",
        revision: "2",
        status: "approved",
        fileAssetId: null,
        notes: "최신 배포본",
      },
      label: `${siteCode}:drawing:A-101`,
      modelKey: "drawings",
    });

    const reviewDrawing = await upsertSeedDocument({
      model: Drawing,
      filter: { siteId: site._id, drawingNo: `${siteCode}-M-205` },
      values: {
        siteId: site._id,
        drawingNo: `${siteCode}-M-205`,
        drawingName: "기계실 배관 상세도",
        discipline: "기계",
        location: "지하 2층",
        revision: "1",
        status: "in_review",
        fileAssetId: null,
        notes: "설비 간섭 재검토 필요",
      },
      label: `${siteCode}:drawing:M-205`,
      modelKey: "drawings",
    });

    await upsertSeedDocument({
      model: DesignChange,
      filter: { siteId: site._id, changeNo: `${siteCode}-DC-001` },
      values: {
        siteId: site._id,
        changeNo: `${siteCode}-DC-001`,
        drawingId: reviewDrawing._id,
        drawingNo: `${siteCode}-M-205`,
        drawingName: "기계실 배관 상세도",
        location: "지하 2층",
        reason: "전기 트레이 간섭으로 배관 루트 조정 필요",
        requestedByName: pm.name,
        reviewedByName: qa.name,
        status: "in_review",
        requestedAt: addDays(today, -1),
        reviewedAt: null,
        reviewComment: "현장 실측 도면 보완 요청",
      },
      label: `${siteCode}:design-change:001`,
      modelKey: "designChanges",
    });

    await upsertSeedDocument({
      model: DesignChange,
      filter: { siteId: site._id, changeNo: `${siteCode}-DC-002` },
      values: {
        siteId: site._id,
        changeNo: `${siteCode}-DC-002`,
        drawingId: mainDrawing._id,
        drawingNo: `${siteCode}-A-101`,
        drawingName: "기준층 평면도",
        location: "기준층",
        reason: "회의실 가벽 위치 미세 조정",
        requestedByName: reviewer.name,
        reviewedByName: siteLead.name,
        status: "approved",
        requestedAt: addDays(today, -6),
        reviewedAt: addDays(today, -4),
        reviewComment: "마감 간섭 없음, 승인",
      },
      label: `${siteCode}:design-change:002`,
      modelKey: "designChanges",
    });

    await upsertSeedDocument({
      model: ResourceLibraryItem,
      filter: { siteId: site._id, title: "현장 운영 체크리스트" },
      values: {
        siteId: site._id,
        categoryCode: "GENERAL",
        title: "현장 운영 체크리스트",
        description: "일일 점검, 회의, 보고 항목을 정리한 운영용 템플릿",
        authorName: siteLead.name,
        fileAssetId: null,
      },
      label: `${siteCode}:resource:ops`,
      modelKey: "resources",
    });

    await upsertSeedDocument({
      model: ResourceLibraryItem,
      filter: { siteId: site._id, title: "품질 문서 제출 양식" },
      values: {
        siteId: site._id,
        categoryCode: "QA",
        title: "품질 문서 제출 양식",
        description: "자재 승인, 시험성적서, NCR 후속조치 제출 양식 모음",
        authorName: qa.name,
        fileAssetId: null,
      },
      label: `${siteCode}:resource:qa`,
      modelKey: "resources",
    });
  }

  const siteCodes = siteContexts.map((context) => String(context.site.siteCode));
  const shouldSkipChildSeeds = DRY_RUN && counters.sites.created > 0;

  await mongoose.disconnect();

  if (shouldSkipChildSeeds) {
    console.log("");
    console.log("[skip] dry-run에서는 신규 demo 현장이 저장되지 않으므로 code/QA/QC child seed를 건너뜁니다.");
  } else if (INCLUDE_CODE_MASTERS) {
    console.log("\n[child] workforce code masters");
    await runChildSeed("seed-workforce-codes.ts", siteCodes);
  }

  if (!shouldSkipChildSeeds && INCLUDE_QA) {
    console.log("\n[child] QA module");
    await runChildSeed("seed-qa-module.ts", siteCodes);
  }

  if (!shouldSkipChildSeeds && INCLUDE_QC) {
    console.log("\n[child] QC module");
    await runChildSeed("seed-qc-module.ts", siteCodes);
  }

  console.log("");
  console.log(`완료: ${formatCounters()}, dryRun=${DRY_RUN}`);
}

void main().catch(async (error) => {
  console.error("[seed-project-demo] 실패", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors on failure path
  }
  process.exitCode = 1;
});

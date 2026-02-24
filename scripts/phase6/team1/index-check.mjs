import mongoose from "mongoose";
import { loadEnvFromLocalFile } from "./load-env.mjs";

loadEnvFromLocalFile();
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI 환경변수가 필요합니다.");
}

function collectStages(node, stages = []) {
  if (!node || typeof node !== "object") return stages;
  if (typeof node.stage === "string") {
    stages.push(node.stage);
  }
  for (const value of Object.values(node)) {
    collectStages(value, stages);
  }
  return stages;
}

function hasExpectedIndex(indexes, expectedKey) {
  return indexes.some((idx) => {
    const keys = idx.key || {};
    return Object.entries(expectedKey).every(([field, direction]) => keys[field] === direction);
  });
}

async function ensureSiteId(db) {
  const sites = db.collection("sites");
  const existing = await sites.findOne({}, { projection: { _id: 1 } });
  if (existing?._id) {
    return existing._id;
  }
  const inserted = await sites.insertOne({
    siteCode: `K${Date.now()}`,
    siteName: "Phase6 인덱스 점검 현장",
    status: "active",
    address: "서울시 강남구",
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    deletedAt: null,
  });
  return inserted.insertedId;
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const siteId = await ensureSiteId(db);

  const checks = [
    {
      name: "documents",
      collection: "documents",
      expectedKey: { siteId: 1, docNo: 1 },
      filter: { siteId },
      sort: { createdAt: -1 },
    },
    {
      name: "drawings",
      collection: "drawings",
      expectedKey: { siteId: 1, drawingNo: 1, revision: -1 },
      filter: { siteId },
      sort: { revision: -1 },
    },
    {
      name: "drawing_reviews",
      collection: "drawingreviews",
      expectedKey: { siteId: 1, requestedAt: -1 },
      filter: { siteId },
      sort: { requestedAt: -1 },
    },
    {
      name: "subcontract_reviews",
      collection: "subcontractreviews",
      expectedKey: { siteId: 1, approvedDate: -1 },
      filter: { siteId },
      sort: { approvedDate: -1 },
    },
    {
      name: "meetings",
      collection: "meetings",
      expectedKey: { siteId: 1, meetingDate: -1 },
      filter: { siteId },
      sort: { meetingDate: -1 },
    },
    {
      name: "issues",
      collection: "issues",
      expectedKey: { siteId: 1, createdAt: -1 },
      filter: { siteId },
      sort: { createdAt: -1 },
    },
    {
      name: "notices",
      collection: "notices",
      expectedKey: { siteId: 1, postedAt: -1 },
      filter: { siteId },
      sort: { postedAt: -1 },
    },
    {
      name: "safety_education_records",
      collection: "safety_education_records",
      expectedKey: { siteId: 1, educationDate: -1 },
      filter: { siteId: String(siteId) },
      sort: { educationDate: -1 },
    },
    {
      name: "audit_logs",
      collection: "audit_logs",
      expectedKey: { siteId: 1, createdAt: -1 },
      filter: { siteId },
      sort: { createdAt: -1 },
    },
  ];

  console.log(`[Phase6-1팀 INDEX] 점검 시작 (siteId=${siteId.toString()})`);
  const failures = [];

  for (const check of checks) {
    const coll = db.collection(check.collection);
    try {
      await coll.createIndex(check.expectedKey);
    } catch {
      // Index may already exist with different options (e.g. unique), which is fine
    }
    const indexes = await coll.indexes();

    if (!hasExpectedIndex(indexes, check.expectedKey)) {
      failures.push(`${check.name}: 권장 인덱스 누락`);
      console.error(`- ${check.name}: 권장 인덱스 누락`);
      continue;
    }

    const explain = await coll
      .find(check.filter)
      .sort(check.sort)
      .limit(20)
      .explain("executionStats");
    const executionStats = explain.executionStats || {};
    const stages = collectStages(explain);
    const docsExamined = Number(executionStats.totalDocsExamined || 0);
    const keysExamined = Number(executionStats.totalKeysExamined || 0);
    const executionTimeMillis = Number(executionStats.executionTimeMillis || 0);
    const usesCollectionScan = stages.includes("COLLSCAN");

    console.log(
      `- ${check.name}: time=${executionTimeMillis}ms, docs=${docsExamined}, keys=${keysExamined}, stages=${stages.join(">")}`,
    );

    if (usesCollectionScan && docsExamined > 0) {
      failures.push(`${check.name}: COLLSCAN 감지`);
    }
  }

  await mongoose.disconnect();

  if (failures.length > 0) {
    console.error("[Phase6-1팀 INDEX] 실패 항목:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("[Phase6-1팀 INDEX] 9개 인덱스 점검 통과");
}

main().catch(async (err) => {
  console.error("[Phase6-1팀 INDEX] 실패:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

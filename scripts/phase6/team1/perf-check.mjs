import { loadEnvFromLocalFile } from "./load-env.mjs";

loadEnvFromLocalFile();
const BASE_URL = (process.env.PMIS_BASE_URL || "http://127.0.0.1:3070").replace(/\/$/, "");
const ITERATIONS = Number(process.env.PMIS_PERF_ITERATIONS ?? 5);
const PASS_THRESHOLD_MS = Number(process.env.PMIS_PERF_THRESHOLD_MS ?? 1000);

const endpoints = [
  "/api/dashboard/summary",
  "/api/documents?page=1&limit=20",
  "/api/drawings?page=1&limit=20",
  "/api/drawing-reviews?page=1&limit=20",
  "/api/meetings?page=1&limit=20",
  "/api/issues?page=1&limit=20",
  "/api/progress/summary",
];

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function fetchEndpoint(endpoint) {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Origin: BASE_URL },
  });
  const elapsed = performance.now() - started;
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(`${endpoint} 응답 실패: ${json.error || response.statusText}`);
  }
  return elapsed;
}

async function runEndpoint(endpoint) {
  const samples = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const elapsed = await fetchEndpoint(endpoint);
    samples.push(elapsed);
  }

  const avgMs = samples.reduce((acc, value) => acc + value, 0) / samples.length;
  return {
    endpoint,
    avgMs,
    p95Ms: percentile(samples, 95),
    maxMs: Math.max(...samples),
    samples: samples.length,
  };
}

async function main() {
  console.log(`[Phase6-1팀 PERF] 시작: ${BASE_URL}, 반복=${ITERATIONS}, 기준=${PASS_THRESHOLD_MS}ms`);
  const results = [];
  for (const endpoint of endpoints) {
    const result = await runEndpoint(endpoint);
    results.push(result);
    console.log(
      `${endpoint} -> avg=${result.avgMs.toFixed(1)}ms, p95=${result.p95Ms.toFixed(1)}ms, max=${result.maxMs.toFixed(1)}ms`,
    );
  }

  const failed = results.filter((row) => row.p95Ms > PASS_THRESHOLD_MS);
  if (failed.length > 0) {
    console.error("[Phase6-1팀 PERF] 기준 초과 엔드포인트:");
    for (const row of failed) {
      console.error(`- ${row.endpoint}: p95=${row.p95Ms.toFixed(1)}ms`);
    }
    process.exit(1);
  }

  console.log("[Phase6-1팀 PERF] 모든 엔드포인트가 기준 이내입니다.");
}

main().catch((err) => {
  console.error("[Phase6-1팀 PERF] 실패:", err?.message || err);
  process.exit(1);
});

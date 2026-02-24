import { promises as fs } from "node:fs";
import path from "node:path";
import { loadEnvFromLocalFile } from "./load-env.mjs";

loadEnvFromLocalFile();
const BASE_URL = (process.env.PMIS_BASE_URL || "http://127.0.0.1:3070").replace(/\/$/, "");
const API_ROOT = path.join(process.cwd(), "src", "app", "api");
const isDevBypassMode =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  process.env.PMIS_REQUIRE_LOGIN !== "true";
const staticOnly = process.env.PMIS_SECURITY_STATIC_ONLY === "true";

const criticalMutationTargets = [
  `${path.sep}documents${path.sep}route.ts`,
  `${path.sep}documents${path.sep}[documentId]${path.sep}route.ts`,
  `${path.sep}drawing-reviews${path.sep}route.ts`,
  `${path.sep}drawing-reviews${path.sep}[reviewId]${path.sep}decision${path.sep}route.ts`,
  `${path.sep}meetings${path.sep}route.ts`,
  `${path.sep}meetings${path.sep}[meetingId]${path.sep}minutes${path.sep}route.ts`,
  `${path.sep}issues${path.sep}route.ts`,
  `${path.sep}subcontract-reviews${path.sep}route.ts`,
  `${path.sep}integrations${path.sep}open-meteo${path.sep}sync${path.sep}route.ts`,
  `${path.sep}integrations${path.sep}open-meteo${path.sep}retry-failed${path.sep}route.ts`,
  `${path.sep}integrations${path.sep}wis${path.sep}sync${path.sep}route.ts`,
  `${path.sep}integrations${path.sep}wis${path.sep}retry-failed${path.sep}route.ts`,
  `${path.sep}system${path.sep}support${path.sep}tickets${path.sep}route.ts`,
  `${path.sep}system${path.sep}support${path.sep}tickets${path.sep}[ticketId]${path.sep}route.ts`,
];

async function walkRouteFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkRouteFiles(fullPath)));
    } else if (entry.isFile() && entry.name === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

async function runStaticChecks() {
  const files = await walkRouteFiles(API_ROOT);
  const failures = [];

  for (const file of files) {
    const isCriticalTarget = criticalMutationTargets.some((target) => file.endsWith(target));
    if (!isCriticalTarget) {
      continue;
    }
    const content = await fs.readFile(file, "utf8");

    if (!content.includes("requireRole(")) {
      failures.push(`${file}: mutation route에 requireRole 누락`);
    }
    if (!content.includes("assertSafeMutationRequest(")) {
      failures.push(`${file}: mutation route에 assertSafeMutationRequest 누락`);
    }
  }

  return failures;
}

async function runDynamicChecks() {
  const failures = [];
  const origin = BASE_URL;

  const xssResponse = await fetch(`${BASE_URL}/api/issues`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify({
      title: "<script>alert('xss')</script>",
      content: "test content",
    }),
  });
  const xssJson = await xssResponse.json();
  if (xssResponse.ok && xssJson.ok) {
    failures.push("동적 검사: XSS payload가 차단되지 않았습니다.");
  }

  const searchResponse = await fetch(
    `${BASE_URL}/api/search/unified?q=${encodeURIComponent("<img src=x onerror=alert(1)>")}`,
    {
      headers: { Origin: origin },
    },
  );
  if (!searchResponse.ok) {
    failures.push(`동적 검사: 통합검색 응답 실패 (${searchResponse.status})`);
  }

  if (!isDevBypassMode) {
    const csrfResponse = await fetch(`${BASE_URL}/api/issues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example.com",
      },
      body: JSON.stringify({ title: "CSRF TEST", content: "should fail" }),
    });
    if (csrfResponse.status !== 403) {
      failures.push(`동적 검사: CSRF 차단 실패 (status=${csrfResponse.status})`);
    }
  } else {
    console.log("[SECURITY] dev auth bypass 모드에서는 CSRF Origin 검사를 skip합니다.");
  }

  return failures;
}

async function main() {
  console.log(
    `[Phase6-1팀 SECURITY] 시작: ${BASE_URL}${staticOnly ? " (static only)" : ""}`,
  );
  const staticFailures = await runStaticChecks();
  const dynamicFailures = staticOnly ? [] : await runDynamicChecks();
  const failures = [...staticFailures, ...dynamicFailures];

  if (failures.length > 0) {
    console.error("[Phase6-1팀 SECURITY] 실패 항목:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("[Phase6-1팀 SECURITY] 정적/동적 보안 점검 통과");
}

main().catch((err) => {
  console.error("[Phase6-1팀 SECURITY] 실패:", err?.message || err);
  process.exit(1);
});

import { loadEnvFromLocalFile } from "./load-env.mjs";

loadEnvFromLocalFile();
const BASE_URL = (process.env.PMIS_BASE_URL || "http://127.0.0.1:3070").replace(/\/$/, "");

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestApi(path, options = {}) {
  const method = options.method || "GET";
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(`${method} ${path} 실패: ${json.error || response.statusText}`);
  }
  return json;
}

async function runScenario1DocumentFlow(suffix) {
  const created = await requestApi("/api/documents", {
    method: "POST",
    body: {
      title: `E2E 문서 ${suffix}`,
      content: "Phase6 자동화 시나리오",
      ledgerType: "instruction",
      direction: "internal",
      status: "in_review",
      approvalLines: [{ approverName: "E2E 결재자", approverRoleTitle: "관리자", order: 1 }],
    },
  });
  const documentId = String(created.data?._id || "");
  const docNo = String(created.data?.docNo || "");
  assertCondition(documentId, "시나리오1: 문서 생성 ID 누락");
  assertCondition(docNo, "시나리오1: 문서번호 누락");

  await requestApi(`/api/documents/${documentId}`, {
    method: "PATCH",
    body: { status: "approved", finalApproverName: "E2E 결재자" },
  });

  const list = await requestApi(`/api/documents?status=approved&q=${encodeURIComponent(docNo)}&page=1&limit=10`);
  const matched = (list.data || []).some((row) => String(row.docNo) === docNo);
  assertCondition(matched, "시나리오1: 승인 문서 조회 실패");
  return { docNo };
}

async function runScenario2DrawingReviewFlow(suffix, docNo) {
  const created = await requestApi("/api/drawing-reviews", {
    method: "POST",
    body: {
      docNo,
      drawingNo: `DRW-${suffix}`,
      drawingName: `E2E 도면 ${suffix}`,
      requestContent: "검토 요청",
      reviewerName: "E2E 검토자",
    },
  });

  const reviewId = String(created.data?._id || "");
  const drawingNo = String(created.data?.drawingNo || "");
  assertCondition(reviewId, "시나리오2: 도면검토 생성 ID 누락");

  await requestApi(`/api/drawing-reviews/${reviewId}/decision`, {
    method: "POST",
    body: { decisionStatus: "approved", decisionComment: "승인" },
  });

  const list = await requestApi(`/api/drawing-reviews?status=approved&q=${encodeURIComponent(drawingNo)}&page=1&limit=10`);
  const matched = (list.data || []).some(
    (row) => String(row._id) === reviewId && String(row.decisionStatus) === "approved",
  );
  assertCondition(matched, "시나리오2: 검토결과 승인 반영 실패");
}

async function runScenario3SubcontractFlow(suffix) {
  const created = await requestApi("/api/subcontract-reviews", {
    method: "POST",
    body: {
      title: `E2E 하도급 검토 ${suffix}`,
      contractorName: "E2E 협력사",
      workType: "토목",
      contractAmount: 1000000,
      status: "pending",
      items: [
        { checkItem: "면허 확인", result: "pass", remarks: "정상" },
        { checkItem: "보험 확인", result: "pass", remarks: "정상" },
      ],
    },
  });

  const reviewId = String(created.data?._id || "");
  assertCondition(reviewId, "시나리오3: 하도급 검토 생성 ID 누락");

  const list = await requestApi("/api/subcontract-reviews?page=1&limit=10");
  const matched = (list.data || []).some((row) => String(row._id) === reviewId);
  assertCondition(matched, "시나리오3: 하도급 검토 대장 조회 실패");
}

async function runScenario4MeetingFlow(suffix) {
  const today = new Date().toISOString().slice(0, 10);
  const created = await requestApi("/api/meetings", {
    method: "POST",
    body: {
      category: "정기회의",
      agenda: `E2E 회의 ${suffix}`,
      meetingDate: today,
      startTime: "10:00",
      endTime: "10:30",
      location: "회의실",
      attendees: [{ company: "삼성물산", department: "공무팀", position: "대리", name: "E2E 참석자" }],
    },
  });
  const meetingId = String(created.data?._id || "");
  assertCondition(meetingId, "시나리오4: 회의 생성 ID 누락");

  await requestApi(`/api/meetings/${meetingId}/minutes`, {
    method: "PATCH",
    body: { minutes: "E2E 회의록 작성 완료" },
  });

  const summary = await requestApi("/api/dashboard/summary");
  const meetingsToday = Number(summary.data?.meetingsToday || 0);
  assertCondition(meetingsToday >= 1, "시나리오4: 대시보드 회의 집계 반영 실패");
}

async function main() {
  const suffix = `${Date.now()}`;
  console.log(`[Phase6-1팀 E2E] 시작: ${BASE_URL}`);

  const doc = await runScenario1DocumentFlow(suffix);
  await runScenario2DrawingReviewFlow(suffix, doc.docNo);
  await runScenario3SubcontractFlow(suffix);
  await runScenario4MeetingFlow(suffix);

  console.log("[Phase6-1팀 E2E] 4개 시나리오 통과");
}

main().catch((err) => {
  console.error("[Phase6-1팀 E2E] 실패:", err?.message || err);
  process.exit(1);
});

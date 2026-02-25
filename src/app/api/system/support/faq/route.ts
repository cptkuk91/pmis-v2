import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";

const faqItems = [
  {
    id: "faq-login-1",
    category: "계정",
    question: "로그인이 되지 않습니다.",
    answer:
      "사내 계정 잠금 여부를 먼저 확인하고, 비밀번호 초기화 이후에도 실패하면 Support 티켓으로 접수해 주세요.",
  },
  {
    id: "faq-dis-1",
    category: "DIS 연동",
    question: "DIS 도면 열람이 되지 않습니다.",
    answer:
      "DIS 계정 권한과 사내망 접속 상태를 확인하세요. PMIS 도면 검색에서 동일 도면번호가 조회되는지도 함께 확인이 필요합니다.",
  },
  {
    id: "faq-ticket-1",
    category: "문의/장애",
    question: "문의 티켓 상태는 어떻게 변경되나요?",
    answer:
      "기본 상태는 Open이며 담당자가 In Progress, Resolved, Closed 순으로 갱신합니다. 해결 내용은 티켓 상세에 기록됩니다.",
  },
];

export async function GET() {
  try {
    await requireRole("viewer");
    return success(faqItems);
  } catch (err) {
    return handleApiError(err);
  }
}

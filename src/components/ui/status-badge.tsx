import { Badge } from "@/components/ui/badge";

type StatusValue =
  | "draft"
  | "in_review"
  | "approved"
  | "rejected"
  | "completed"
  | "open"
  | "closed"
  | "pass"
  | "fail"
  | "info"
  | "success"
  | "warning"
  | "danger";

const statusMap: Record<StatusValue, { label: string; tone: "info" | "success" | "warning" | "danger" | "default" }> =
  {
    draft: { label: "임시저장", tone: "default" },
    in_review: { label: "검토중", tone: "warning" },
    approved: { label: "승인", tone: "success" },
    rejected: { label: "반려", tone: "danger" },
    completed: { label: "완료", tone: "success" },
    open: { label: "Open", tone: "info" },
    closed: { label: "Closed", tone: "default" },
    pass: { label: "합격", tone: "success" },
    fail: { label: "불합격", tone: "danger" },
    info: { label: "정보", tone: "info" },
    success: { label: "정상", tone: "success" },
    warning: { label: "주의", tone: "warning" },
    danger: { label: "위험", tone: "danger" },
  };

type StatusBadgeProps = {
  status: StatusValue;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const matched = statusMap[status] ?? { label: status, tone: "default" as const };
  return <Badge tone={matched.tone}>{matched.label}</Badge>;
}

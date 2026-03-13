import { Badge } from "@/components/ui/badge";
import {
  QC_MATERIAL_INSPECTION_RESULT_LABELS,
  type QcMaterialInspectionResult,
} from "@/lib/qc-material-inspections";

type QcResultBadgeProps = {
  result: QcMaterialInspectionResult;
};

export function QcResultBadge({ result }: QcResultBadgeProps) {
  const tone =
    result === "pass"
      ? "success"
      : result === "fail"
        ? "danger"
        : result === "reinspection"
          ? "warning"
          : "default";

  return <Badge tone={tone}>{QC_MATERIAL_INSPECTION_RESULT_LABELS[result]}</Badge>;
}

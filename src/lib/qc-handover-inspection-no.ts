import QcHandoverInspection from "@/models/QcHandoverInspection";

const QC_HANDOVER_NO_SEQUENCE_WIDTH = 3;

function formatDatePart(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseSequence(inspectionNo: string, datePart: string): number {
  const matched = inspectionNo.match(
    new RegExp(`^HND-${datePart}-(\\d{${QC_HANDOVER_NO_SEQUENCE_WIDTH}})$`),
  );
  if (!matched) {
    return 0;
  }
  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildQcHandoverInspectionNo(datePart: string, sequence: number) {
  return `HND-${datePart}-${String(sequence).padStart(QC_HANDOVER_NO_SEQUENCE_WIDTH, "0")}`;
}

export async function generateNextQcHandoverInspectionNo(siteId: string, baseDate: Date = new Date()) {
  const datePart = formatDatePart(baseDate);
  const regex = new RegExp(`^HND-${datePart}-(\\d{${QC_HANDOVER_NO_SEQUENCE_WIDTH}})$`);
  const latest = await QcHandoverInspection.findOne({ siteId, inspectionNo: regex })
    .sort({ inspectionNo: -1 })
    .select({ inspectionNo: 1 })
    .lean<{ inspectionNo?: string } | null>();

  const nextSequence = parseSequence(latest?.inspectionNo ?? "", datePart) + 1;
  return buildQcHandoverInspectionNo(datePart, nextSequence);
}

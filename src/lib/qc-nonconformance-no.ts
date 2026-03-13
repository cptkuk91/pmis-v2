import QcNonconformance from "@/models/QcNonconformance";

const QC_NONCONFORMANCE_NO_SEQUENCE_WIDTH = 3;

function formatDatePart(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseSequence(ncrNo: string, datePart: string): number {
  const matched = ncrNo.match(new RegExp(`^NCR-${datePart}-(\\d{${QC_NONCONFORMANCE_NO_SEQUENCE_WIDTH}})$`));
  if (!matched) {
    return 0;
  }
  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildQcNonconformanceNo(datePart: string, sequence: number) {
  return `NCR-${datePart}-${String(sequence).padStart(QC_NONCONFORMANCE_NO_SEQUENCE_WIDTH, "0")}`;
}

export async function generateNextQcNonconformanceNo(siteId: string, baseDate: Date = new Date()) {
  const datePart = formatDatePart(baseDate);
  const regex = new RegExp(`^NCR-${datePart}-(\\d{${QC_NONCONFORMANCE_NO_SEQUENCE_WIDTH}})$`);
  const latest = await QcNonconformance.findOne({ siteId, ncrNo: regex })
    .sort({ ncrNo: -1 })
    .select({ ncrNo: 1 })
    .lean<{ ncrNo?: string } | null>();

  const nextSequence = parseSequence(latest?.ncrNo ?? "", datePart) + 1;
  return buildQcNonconformanceNo(datePart, nextSequence);
}

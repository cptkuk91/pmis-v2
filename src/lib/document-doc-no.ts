import DocumentModel from "@/models/Document";
import DrawingReview from "@/models/DrawingReview";

const DOCUMENT_NO_SEQUENCE_WIDTH = 5;

function formatDatePart(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function buildDocumentNo(datePart: string, sequence: number): string {
  return `DOC-${datePart}-${String(sequence).padStart(DOCUMENT_NO_SEQUENCE_WIDTH, "0")}`;
}

function parseDocumentSequence(docNo: string, datePart: string): number {
  const matched = docNo.match(new RegExp(`^DOC-${datePart}-(\\d{${DOCUMENT_NO_SEQUENCE_WIDTH}})$`));
  if (!matched) {
    return 0;
  }

  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function generateNextDocumentNo(siteId: string, baseDate: Date = new Date()): Promise<string> {
  const datePart = formatDatePart(baseDate);
  const regex = new RegExp(`^DOC-${datePart}-(\\d{${DOCUMENT_NO_SEQUENCE_WIDTH}})$`);
  const [latestDocument, latestDrawingReview] = await Promise.all([
    DocumentModel.findOne({
      siteId,
      docNo: regex,
    })
      .sort({ docNo: -1 })
      .select({ docNo: 1 })
      .lean<{ docNo?: string } | null>(),
    DrawingReview.findOne({
      siteId,
      docNo: regex,
    })
      .sort({ docNo: -1 })
      .select({ docNo: 1 })
      .lean<{ docNo?: string } | null>(),
  ]);

  const nextSequence =
    Math.max(
      parseDocumentSequence(latestDocument?.docNo ?? "", datePart),
      parseDocumentSequence(latestDrawingReview?.docNo ?? "", datePart),
    ) + 1;
  return buildDocumentNo(datePart, nextSequence);
}

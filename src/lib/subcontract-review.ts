import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import { ensureAllowedWorkType } from "@/lib/work-type-code";

export type SubcontractReviewItemResult = "pass" | "fail" | "na";

export type NormalizedSubcontractReviewItem = {
  checkItem: string;
  result: SubcontractReviewItemResult;
  remarks: string;
};

export type NormalizedSubcontractReviewPayload = {
  siteId: string;
  title: string;
  contractorName: string;
  workType: string;
  contractAmount: number;
  requestDate: Date;
  remarks: string;
  items: NormalizedSubcontractReviewItem[];
};

export function buildSubcontractReviewTitle(contractorName: string, workType: string) {
  return workType ? `${contractorName} / ${workType}` : contractorName;
}

function parseNonNegativeNumber(value: unknown, fieldLabel: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw VALIDATION_ERROR(`${fieldLabel} 값이 올바르지 않습니다.`);
  }

  return Math.max(0, parsed);
}

function parseOptionalDate(value: unknown, fieldLabel: string): Date | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }

  return parsed;
}

function normalizeItemResult(value: unknown): SubcontractReviewItemResult {
  const result = String(value ?? "").trim().toLowerCase();
  if (!result) {
    return "pass";
  }

  if (result === "pass" || result === "fail" || result === "na") {
    return result;
  }

  throw VALIDATION_ERROR("검토 항목 결과 값이 올바르지 않습니다.");
}

export async function normalizeSubcontractReviewPayload(
  body: Record<string, unknown>,
): Promise<NormalizedSubcontractReviewPayload> {
  const siteId = String(body.siteId ?? "").trim();
  const contractorName = String(body.contractorName ?? "").trim();
  const workType = String(body.workType ?? "").trim();
  const remarks = String(body.remarks ?? "").trim();

  if (!siteId) {
    throw VALIDATION_ERROR("siteId가 필요합니다.");
  }
  if (!mongoose.Types.ObjectId.isValid(siteId)) {
    throw VALIDATION_ERROR("siteId 형식이 올바르지 않습니다.");
  }
  if (!contractorName) {
    throw VALIDATION_ERROR("업체명은 필수입니다.");
  }

  assertNoUnsafeHtml(contractorName, "업체명");
  assertNoUnsafeHtml(remarks, "비고");

  if (workType) {
    assertNoUnsafeHtml(workType, "공종");
  }

  await ensureAllowedWorkType(siteId, workType);

  const items = Array.isArray(body.items)
    ? body.items.reduce<NormalizedSubcontractReviewItem[]>((acc, item, index) => {
        const nextItem = item as Record<string, unknown>;
        const checkItem = String(nextItem?.checkItem ?? "").trim();
        const itemRemarks = String(nextItem?.remarks ?? "").trim();

        if (!checkItem) {
          return acc;
        }

        assertNoUnsafeHtml(checkItem, `검토항목(${index + 1})`);
        assertNoUnsafeHtml(itemRemarks, `검토의견(${index + 1})`);

        acc.push({
          checkItem,
          result: normalizeItemResult(nextItem?.result),
          remarks: itemRemarks,
        });
        return acc;
      }, [])
    : [];

  return {
    siteId,
    title: buildSubcontractReviewTitle(contractorName, workType),
    contractorName,
    workType,
    contractAmount: parseNonNegativeNumber(body.contractAmount, "계약금액"),
    requestDate: parseOptionalDate(body.requestDate, "요청일") ?? new Date(),
    remarks,
    items,
  };
}

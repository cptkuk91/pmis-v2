import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import {
  isQaPartnerCategory,
  isQaPartnerEvaluationType,
  isQaPartnerFollowUpStatus,
  isQaPartnerGrade,
  isQaPartnerRiskLevel,
} from "@/lib/qa-partner-assurance";
import { normalizeQaPartnerAssurancePayload } from "@/lib/qa-partner-assurance-payload";
import QaCapa from "@/models/QaCapa";
import QaPartnerAssurance from "@/models/QaPartnerAssurance";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type QaPartnerAssuranceSort = "evaluation_desc" | "evaluation_asc" | "score_desc" | "partner_name";

function parsePartnerAssuranceSort(value: string): QaPartnerAssuranceSort {
  if (
    value === "evaluation_desc" ||
    value === "evaluation_asc" ||
    value === "score_desc" ||
    value === "partner_name"
  ) {
    return value;
  }
  throw VALIDATION_ERROR("정렬 값이 올바르지 않습니다.");
}

function getPartnerAssuranceSort(sort: QaPartnerAssuranceSort): Record<string, 1 | -1> {
  switch (sort) {
    case "evaluation_asc":
      return { evaluationDate: 1, createdAt: 1 };
    case "score_desc":
      return { totalScore: -1, evaluationDate: -1, createdAt: -1 };
    case "partner_name":
      return { partnerName: 1, evaluationDate: -1, createdAt: -1 };
    case "evaluation_desc":
    default:
      return { evaluationDate: -1, createdAt: -1 };
  }
}

async function assertLinkedCapa(siteId: string, capaId: string) {
  if (!capaId) {
    return;
  }

  const exists = await QaCapa.exists({ _id: capaId, siteId });
  if (!exists) {
    throw VALIDATION_ERROR("연결된 CAPA를 찾을 수 없습니다.");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([], {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        summary: {
          evaluationCount: 0,
          distinctPartnerCount: 0,
          followUpPendingCount: 0,
          highRiskCount: 0,
          linkedCapaCount: 0,
        },
      });
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const partnerName = String(request.nextUrl.searchParams.get("partnerName") ?? "").trim();
    const evaluationType = String(request.nextUrl.searchParams.get("evaluationType") ?? "all").trim();
    const partnerCategory = String(request.nextUrl.searchParams.get("partnerCategory") ?? "all").trim();
    const grade = String(request.nextUrl.searchParams.get("grade") ?? "all").trim();
    const riskLevel = String(request.nextUrl.searchParams.get("riskLevel") ?? "all").trim();
    const followUpStatus = String(request.nextUrl.searchParams.get("followUpStatus") ?? "all").trim();
    const sort = parsePartnerAssuranceSort(
      String(request.nextUrl.searchParams.get("sort") ?? "evaluation_desc").trim(),
    );
    const skip = (page - 1) * limit;

    const siteObjectId = new mongoose.Types.ObjectId(siteId);
    const baseFilter: Record<string, unknown> = { siteId: siteObjectId };
    const filter: Record<string, unknown> = { siteId: siteObjectId };

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { partnerName: regex },
        { summary: regex },
        { improvementRequest: regex },
        { scopeSummary: regex },
        { evaluatorName: regex },
        { "assessmentItems.criterionTitle": regex },
      ];
    }
    if (partnerName) {
      filter.partnerName = partnerName;
    }
    if (evaluationType !== "all") {
      if (!isQaPartnerEvaluationType(evaluationType)) {
        throw VALIDATION_ERROR("평가 유형 필터 값이 올바르지 않습니다.");
      }
      filter.evaluationType = evaluationType;
    }
    if (partnerCategory !== "all") {
      if (!isQaPartnerCategory(partnerCategory)) {
        throw VALIDATION_ERROR("협력사 구분 필터 값이 올바르지 않습니다.");
      }
      filter.partnerCategory = partnerCategory;
    }
    if (grade !== "all") {
      if (!isQaPartnerGrade(grade)) {
        throw VALIDATION_ERROR("등급 필터 값이 올바르지 않습니다.");
      }
      filter.grade = grade;
    }
    if (riskLevel !== "all") {
      if (!isQaPartnerRiskLevel(riskLevel)) {
        throw VALIDATION_ERROR("리스크 필터 값이 올바르지 않습니다.");
      }
      filter.riskLevel = riskLevel;
    }
    if (followUpStatus !== "all") {
      if (!isQaPartnerFollowUpStatus(followUpStatus)) {
        throw VALIDATION_ERROR("후속조치 상태 필터 값이 올바르지 않습니다.");
      }
      filter.followUpStatus = followUpStatus;
    }

    const [rows, total, summaryRows] = await Promise.all([
      QaPartnerAssurance.find(filter)
        .sort(getPartnerAssuranceSort(sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      QaPartnerAssurance.countDocuments(filter),
      QaPartnerAssurance.find(baseFilter)
        .select({ partnerName: 1, followUpStatus: 1, riskLevel: 1, linkedCapaId: 1 })
        .lean(),
    ]);

    const partnerNames = new Set<string>();
    const summary = summaryRows.reduce(
      (acc, row) => {
        if (row.partnerName) {
          partnerNames.add(row.partnerName);
        }
        if (row.followUpStatus === "requested") {
          acc.followUpPendingCount += 1;
        }
        if (row.riskLevel === "high") {
          acc.highRiskCount += 1;
        }
        if (row.linkedCapaId) {
          acc.linkedCapaCount += 1;
        }
        return acc;
      },
      {
        evaluationCount: summaryRows.length,
        distinctPartnerCount: 0,
        followUpPendingCount: 0,
        highRiskCount: 0,
        linkedCapaCount: 0,
      },
    );
    summary.distinctPartnerCount = partnerNames.size;

    return success(rows, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      summary,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeQaPartnerAssurancePayload(body);
    await assertLinkedCapa(siteId, payload.linkedCapaId);

    const created = await QaPartnerAssurance.create({
      ...payload,
      siteId,
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qa_partner_assurance", String(created._id), requester, {
      partnerName: payload.partnerName,
      grade: payload.grade,
      riskLevel: payload.riskLevel,
      followUpStatus: payload.followUpStatus,
    });

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

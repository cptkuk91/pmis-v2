import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { getFileAssetLinkMap } from "@/lib/file-asset-links";
import { isQaProcedureDocumentType, isQaProcedureReferenceTarget, isQaProcedureStatus } from "@/lib/qa-procedures";
import { normalizeQaProcedurePayload } from "@/lib/qa-procedure-payload";
import QaProcedure from "@/models/QaProcedure";

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

type QaProcedureSort = "document_key" | "updated_desc" | "effective_desc" | "effective_asc";

function parseProcedureSort(value: string): QaProcedureSort {
  if (
    value === "document_key" ||
    value === "updated_desc" ||
    value === "effective_desc" ||
    value === "effective_asc"
  ) {
    return value;
  }
  throw VALIDATION_ERROR("정렬 값이 올바르지 않습니다.");
}

function getProcedureSort(sort: QaProcedureSort): Record<string, 1 | -1> {
  switch (sort) {
    case "updated_desc":
      return { updatedAt: -1, createdAt: -1 };
    case "effective_desc":
      return { effectiveDate: -1, documentKey: 1, versionNo: -1 };
    case "effective_asc":
      return { effectiveDate: 1, documentKey: 1, versionNo: 1 };
    case "document_key":
    default:
      return { documentKey: 1, versionNo: -1, createdAt: -1 };
  }
}

type ProcedureRow = {
  _id: string;
  documentKey: string;
  categoryCode: string;
  documentType: string;
  title: string;
  summary: string;
  scopeType: string;
  scopeSummary: string;
  versionNo: number;
  effectiveDate?: Date | null;
  status: string;
  retiredAt?: Date | null;
  isSiteRequired: boolean;
  referenceTargets: string[];
  externalDocUrl: string;
  fileAssetId?: mongoose.Types.ObjectId | null;
  fileName: string;
  fileUrl?: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
  isLatestVersion?: boolean;
};

function computeLatestVersions(items: ProcedureRow[]): ProcedureRow[] {
  const latestKeySet = new Set<string>();
  const latestMap = new Map<string, ProcedureRow>();

  for (const item of items) {
    const groupKey = `${item.documentType}:${item.documentKey}`;
    const existing = latestMap.get(groupKey);
    if (!existing || item.versionNo > existing.versionNo) {
      latestMap.set(groupKey, item);
    }
  }

  latestMap.forEach((value) => latestKeySet.add(String(value._id)));

  return items.map((item) => ({
    ...item,
    isLatestVersion: latestKeySet.has(String(item._id)),
  }));
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const categoryCode = String(request.nextUrl.searchParams.get("categoryCode") ?? "ALL").trim().toUpperCase();
    const documentType = String(request.nextUrl.searchParams.get("documentType") ?? "all").trim();
    const versionView = String(request.nextUrl.searchParams.get("versionView") ?? "all").trim();
    const referenceTarget = String(request.nextUrl.searchParams.get("referenceTarget") ?? "all").trim();
    const siteRequired = String(request.nextUrl.searchParams.get("siteRequired") ?? "all").trim();
    const sort = parseProcedureSort(String(request.nextUrl.searchParams.get("sort") ?? "document_key").trim());

    const filter: Record<string, unknown> = {
      siteId: new mongoose.Types.ObjectId(siteId),
    };

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { title: regex },
        { summary: regex },
        { documentKey: regex },
        { scopeSummary: regex },
      ];
    }
    if (status !== "all") {
      if (!isQaProcedureStatus(status)) {
        throw VALIDATION_ERROR("상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }
    if (categoryCode !== "ALL") {
      filter.categoryCode = categoryCode;
    }
    if (documentType !== "all") {
      if (!isQaProcedureDocumentType(documentType)) {
        throw VALIDATION_ERROR("문서유형 필터 값이 올바르지 않습니다.");
      }
      filter.documentType = documentType;
    }
    if (referenceTarget !== "all") {
      if (!isQaProcedureReferenceTarget(referenceTarget)) {
        throw VALIDATION_ERROR("참조 포인트 필터 값이 올바르지 않습니다.");
      }
      filter.referenceTargets = referenceTarget;
    }
    if (siteRequired === "yes") {
      filter.isSiteRequired = true;
    }
    if (siteRequired === "no") {
      filter.isSiteRequired = false;
    }

    const allItems = await QaProcedure.find(filter)
      .sort(getProcedureSort(sort))
      .lean<ProcedureRow[]>();

    const withLatestFlag = computeLatestVersions(allItems);
    const filteredByVersion =
      versionView === "latest"
        ? withLatestFlag.filter((item) => item.isLatestVersion)
        : withLatestFlag;

    const total = filteredByVersion.length;
    const skip = (page - 1) * limit;
    const pagedItems = filteredByVersion.slice(skip, skip + limit);
    const fileAssetLinkMap = await getFileAssetLinkMap(
      siteId,
      pagedItems.map((item) => item.fileAssetId),
    );
    const responseItems = pagedItems.map((item) => ({
      ...item,
      fileUrl: item.fileAssetId ? fileAssetLinkMap.get(String(item.fileAssetId))?.url ?? "" : "",
    }));

    return paginated(responseItems, page, limit, total);
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
    const payload = normalizeQaProcedurePayload(body);

    const created = await QaProcedure.create({
      ...payload,
      siteId,
      fileAssetId: payload.fileAssetId ? new mongoose.Types.ObjectId(payload.fileAssetId) : undefined,
      authorName: requester.userName,
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qa_procedure", String(created._id), requester, {
      documentKey: payload.documentKey,
      categoryCode: payload.categoryCode,
      documentType: payload.documentType,
      versionNo: payload.versionNo,
    });

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}

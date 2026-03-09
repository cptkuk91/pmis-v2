import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import HealthCheckRecord from "@/models/HealthCheckRecord";
import SiteMembership from "@/models/SiteMembership";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";

function isCheckType(value: string): value is "regular" | "special" | "hiring" {
  return value === "regular" || value === "special" || value === "hiring";
}

function isResult(value: string): value is "normal" | "observation" | "abnormal" {
  return value === "normal" || value === "observation" || value === "abnormal";
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      HealthCheckRecord.find({ siteId }).sort({ checkDate: -1 }).skip(skip).limit(limit),
      HealthCheckRecord.countDocuments({ siteId }),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = (await request.json()) as Record<string, unknown>;
    const siteId = String(body.siteId ?? "").trim();
    const workerUserIdRaw = String(body.workerUserId ?? "").trim();
    const company = String(body.company ?? "").trim();
    const checkType = String(body.checkType ?? "").trim();
    const result = String(body.result ?? "").trim();
    const hospital = String(body.hospital ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!workerUserIdRaw || !mongoose.Types.ObjectId.isValid(workerUserIdRaw)) {
      throw VALIDATION_ERROR("검진 대상자 선택이 필요합니다.");
    }
    if (!isCheckType(checkType)) {
      throw VALIDATION_ERROR("검진 구분 값이 올바르지 않습니다.");
    }
    if (!isResult(result)) {
      throw VALIDATION_ERROR("검진 결과 값이 올바르지 않습니다.");
    }

    const membership = await SiteMembership.findOne({
      siteId: new mongoose.Types.ObjectId(siteId),
      userId: new mongoose.Types.ObjectId(workerUserIdRaw),
      isActive: true,
      isDeleted: false,
    })
      .populate("userId", "name isActive isDeleted")
      .select({ userId: 1 })
      .lean();

    const user =
      membership?.userId && typeof membership.userId === "object"
        ? (membership.userId as { _id?: unknown; name?: string; isActive?: boolean; isDeleted?: boolean })
        : null;

    if (!membership || !user?._id || !user.name || !user.isActive || user.isDeleted) {
      throw VALIDATION_ERROR("현재 현장에 배정된 사용자를 선택해 주세요.");
    }

    const doc = await HealthCheckRecord.create({
      ...body,
      siteId,
      workerUserId: new mongoose.Types.ObjectId(String(user._id)),
      workerName: String(user.name).trim(),
      company,
      checkType,
      result,
      hospital,
    });

    await logCreate(siteId, "safety_health", String(doc._id), { userId: null, userName: "system" });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SafetyReward from "@/models/SafetyReward";
import Site from "@/models/Site";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import { calculateAccidentFreeDays, resolveAccidentFreeStatus } from "@/lib/accident-free";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    const rewardType = searchParams.get("rewardType");
    if (rewardType) filter.rewardType = rewardType;

    const [site, data, total] = await Promise.all([
      rewardType === "accident_free"
        ? Site.findOne({ _id: siteId, isDeleted: false }).select({ startDate: 1 }).lean()
        : Promise.resolve(null),
      SafetyReward.find(filter).sort({ startDate: -1 }).skip(skip).limit(limit),
      SafetyReward.countDocuments(filter),
    ]);

    if (rewardType === "accident_free") {
      const siteStartDate = site?.startDate ? new Date(site.startDate) : null;
      const normalized = data.map((reward) => {
        const effectiveStartDate = siteStartDate ?? reward.startDate ?? null;
        const achievedDays = calculateAccidentFreeDays(effectiveStartDate);
        const status = resolveAccidentFreeStatus({
          currentStatus: reward.status,
          achievedDays,
          targetDays: reward.targetDays,
        });

        return {
          ...reward.toObject(),
          startDate: effectiveStartDate,
          achievedDays,
          status,
        };
      });

      return paginated(normalized, page, limit, total);
    }

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
    const rewardType = String(body.rewardType ?? "").trim();
    let startDate = body.startDate;

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    if (rewardType === "accident_free") {
      const site = await Site.findOne({ _id: siteId, isDeleted: false }).select({ startDate: 1 }).lean();
      if (!site?.startDate) {
        throw VALIDATION_ERROR("현장 시작일이 설정된 이후에만 무재해 목표를 등록할 수 있습니다.");
      }
      if (site?.startDate) {
        startDate = site.startDate;
      }
    }

    const doc = await SafetyReward.create({
      ...body,
      siteId,
      startDate,
    });

    await logCreate(siteId, "safety_reward", String(doc._id), { userId: null, userName: "system" });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

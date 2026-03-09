import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SafetyReward from "@/models/SafetyReward";
import Site from "@/models/Site";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { calculateAccidentFreeDays, resolveAccidentFreeStatus } from "@/lib/accident-free";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const siteId = request.nextUrl.searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const [site, rewards] = await Promise.all([
      Site.findOne({ _id: siteId, isDeleted: false }).select({ startDate: 1 }).lean(),
      SafetyReward.find({
        siteId,
        rewardType: "accident_free",
        isDeleted: { $ne: true },
      }).sort({ startDate: -1 }),
    ]);

    const siteStartDate = site?.startDate ? new Date(site.startDate) : null;
    const records = rewards.map((reward) => {
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

    const summary = {
      total: records.length,
      inProgress: records.filter((record) => record.status === "in_progress").length,
      achieved: records.filter((record) => record.status === "achieved").length,
      failed: records.filter((record) => record.status === "failed").length,
      records,
    };
    return success(summary);
  } catch (err) {
    return handleApiError(err);
  }
}

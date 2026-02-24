import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SafetyReward from "@/models/SafetyReward";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const siteId = request.nextUrl.searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const rewards = await SafetyReward.find({
      siteId,
      rewardType: "accident_free",
      isDeleted: { $ne: true },
    }).sort({ startDate: -1 });

    const summary = {
      total: rewards.length,
      inProgress: rewards.filter((r) => r.status === "in_progress").length,
      achieved: rewards.filter((r) => r.status === "achieved").length,
      failed: rewards.filter((r) => r.status === "failed").length,
      records: rewards,
    };
    return success(summary);
  } catch (err) {
    return handleApiError(err);
  }
}

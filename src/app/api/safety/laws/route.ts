import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import ExternalLinkItem from "@/models/ExternalLinkItem";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const siteId = request.nextUrl.searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const data = await ExternalLinkItem.find({
      siteId,
      category: "safety_law",
      isDeleted: { $ne: true },
    }).sort({ sortOrder: 1 });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

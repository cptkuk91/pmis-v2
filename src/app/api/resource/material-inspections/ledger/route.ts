import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import MaterialInspection from "@/models/MaterialInspection";
import { paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      MaterialInspection.find({ siteId }).sort({ inspectionDate: -1 }).skip(skip).limit(limit),
      MaterialInspection.countDocuments({ siteId }),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

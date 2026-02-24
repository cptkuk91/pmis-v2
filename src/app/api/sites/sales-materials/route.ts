import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import FileAsset from "@/models/FileAsset";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

const MODULE = "sales-materials";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const filter = { siteId, module: MODULE };
    const [data, total] = await Promise.all([
      FileAsset.find(filter)
        .populate("uploadedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FileAsset.countDocuments(filter),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

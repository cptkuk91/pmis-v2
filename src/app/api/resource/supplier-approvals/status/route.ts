import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SupplierApprovalRequest from "@/models/SupplierApprovalRequest";
import { paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const status = searchParams.get("status");
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (status) filter.status = status;

    const [data, total] = await Promise.all([
      SupplierApprovalRequest.find(filter).sort({ requestDate: -1 }).skip(skip).limit(limit),
      SupplierApprovalRequest.countDocuments(filter),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

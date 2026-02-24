import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SafetyDocument from "@/models/SafetyDocument";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";

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
    const docType = searchParams.get("docType");
    if (docType) filter.docType = docType;

    const [data, total] = await Promise.all([
      SafetyDocument.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SafetyDocument.countDocuments(filter),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const doc = await SafetyDocument.create(body);

    await logCreate(body.siteId, "safety_standard", String(doc._id), { userId: null, userName: "system" });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

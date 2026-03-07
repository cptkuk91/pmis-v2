import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import SafetyRegulationItem from "@/models/SafetyRegulationItem";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import { isSafetyRegulationCategory } from "@/lib/safety-regulation-category";

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
      SafetyRegulationItem.find({ siteId, isActive: true }).sort({ sortOrder: 1 }).skip(skip).limit(limit),
      SafetyRegulationItem.countDocuments({ siteId, isActive: true }),
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
    const category = String(body.category ?? "").trim();
    const title = String(body.title ?? "").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isSafetyRegulationCategory(category)) {
      throw VALIDATION_ERROR("category 값이 올바르지 않습니다.");
    }
    if (!title) {
      throw VALIDATION_ERROR("title은 필수입니다.");
    }

    const doc = await SafetyRegulationItem.create({
      siteId,
      category,
      title,
      content: String(body.content ?? "").trim(),
      reference: String(body.reference ?? "").trim(),
      sortOrder: Number(body.sortOrder ?? 0) || 0,
    });

    await logCreate(siteId, "safety_regulation", String(doc._id), { userId: null, userName: "system" });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

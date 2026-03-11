import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import MaterialPlanActual from "@/models/MaterialPlanActual";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import { normalizeMaterialPlanActualPayload } from "@/lib/material-plan-actual";

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
      MaterialPlanActual.find({ siteId }).sort({ planDate: -1 }).skip(skip).limit(limit),
      MaterialPlanActual.countDocuments({ siteId }),
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
    const payload = normalizeMaterialPlanActualPayload(body);
    const doc = await MaterialPlanActual.create({
      siteId: payload.siteId,
      materialName: payload.materialName,
      specification: payload.specification || undefined,
      unit: payload.unit,
      planQty: payload.planQty,
      actualQty: payload.actualQty,
      planDate: payload.planDate,
      actualDate: payload.actualDate,
      supplier: payload.supplier || undefined,
      unitPrice: payload.unitPrice,
      remarks: payload.remarks || undefined,
    });
    await logCreate(payload.siteId, "material", String(doc._id), { userId: null, userName: "system" });
    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

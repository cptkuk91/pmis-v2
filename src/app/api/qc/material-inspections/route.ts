import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import MaterialInspection from "@/models/MaterialInspection";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();
    const { searchParams } = request.nextUrl;
    const querySiteId = searchParams.get("siteId");
    const siteId = querySiteId || (await resolveSiteId(request));
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const result = searchParams.get("result");
    const filter: Record<string, unknown> = { siteId };
    if (result) filter.result = result;

    const [data, total] = await Promise.all([
      MaterialInspection.find(filter).sort({ inspectionDate: -1 }).skip(skip).limit(limit).lean(),
      MaterialInspection.countDocuments(filter),
    ]);
    return paginated(data, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();
    const body = await request.json();
    const siteId = (await resolveSiteId(request)) || String(body.siteId ?? "");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const materialName = String(body.materialName ?? "").trim();
    if (!materialName) throw VALIDATION_ERROR("자재명은 필수입니다.");

    const doc = await MaterialInspection.create({
      siteId,
      materialName,
      specification: body.specification,
      supplier: body.supplier,
      quantity: Number(body.quantity ?? 0),
      unit: String(body.unit ?? "").trim(),
      inspectionDate: body.inspectionDate ? new Date(body.inspectionDate) : new Date(),
      result: body.result || "pending",
      inspector: body.inspector,
      remarks: body.remarks,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    logCreate(String(siteId), "material_inspection", String(doc._id), requester);
    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

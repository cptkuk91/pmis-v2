import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import MaterialPlanActual from "@/models/MaterialPlanActual";
import EquipmentPlanActual from "@/models/EquipmentPlanActual";
import SubcontractReview from "@/models/SubcontractReview";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const siteId = request.nextUrl.searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");

    const [materialCost, equipmentCost, subcontractCost] = await Promise.all([
      MaterialPlanActual.aggregate([
        { $match: { siteId: { $eq: siteId }, isDeleted: { $ne: true } } },
        { $group: { _id: null, planTotal: { $sum: { $multiply: ["$planQty", "$unitPrice"] } }, actualTotal: { $sum: { $multiply: ["$actualQty", "$unitPrice"] } } } },
      ]),
      EquipmentPlanActual.aggregate([
        { $match: { siteId: { $eq: siteId }, isDeleted: { $ne: true } } },
        { $group: { _id: null, planTotal: { $sum: { $multiply: ["$planQty", "$unitPrice"] } }, actualTotal: { $sum: { $multiply: ["$actualQty", "$unitPrice"] } } } },
      ]),
      SubcontractReview.aggregate([
        { $match: { siteId: { $eq: siteId }, status: "approved", isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: "$contractAmount" } } },
      ]),
    ]);

    return success({
      material: materialCost[0] ?? { planTotal: 0, actualTotal: 0 },
      equipment: equipmentCost[0] ?? { planTotal: 0, actualTotal: 0 },
      subcontract: subcontractCost[0]?.total ?? 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

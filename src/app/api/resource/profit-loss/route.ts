import { NextRequest } from "next/server";
import mongoose from "mongoose";
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
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      throw VALIDATION_ERROR("siteId 형식이 올바르지 않습니다.");
    }

    const siteObjectId = new mongoose.Types.ObjectId(siteId);

    const [materialCost, equipmentCost, subcontractCost] = await Promise.all([
      MaterialPlanActual.aggregate([
        { $match: { siteId: { $eq: siteObjectId }, isDeleted: { $ne: true } } },
        { $group: { _id: null, planTotal: { $sum: { $multiply: ["$planQty", "$unitPrice"] } }, actualTotal: { $sum: { $multiply: ["$actualQty", "$unitPrice"] } } } },
      ]),
      EquipmentPlanActual.aggregate([
        { $match: { siteId: { $eq: siteObjectId }, isDeleted: { $ne: true } } },
        { $group: { _id: null, planTotal: { $sum: { $multiply: ["$planQty", "$unitPrice"] } }, actualTotal: { $sum: { $multiply: ["$actualQty", "$unitPrice"] } } } },
      ]),
      SubcontractReview.aggregate([
        { $match: { siteId: { $eq: siteObjectId }, status: "approved", isDeleted: { $ne: true } } },
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

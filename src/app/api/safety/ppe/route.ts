import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import PPEDistributionRecord from "@/models/PPEDistributionRecord";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import {
  DEFAULT_PPE_UNIT_BY_ITEM,
  isPPEItemName,
  isPPEUnit,
} from "@/lib/ppe-options";

type PPEBatchItem = {
  itemName: string;
  specification: string;
  quantity: number;
  unit: string;
};

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
      PPEDistributionRecord.find({ siteId }).sort({ distributionDate: -1 }).skip(skip).limit(limit),
      PPEDistributionRecord.countDocuments({ siteId }),
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
    const recipientName = String(body.recipientName ?? "").trim();
    const recipientCompany = String(body.recipientCompany ?? "").trim();
    const distributionDateRaw = String(body.distributionDate ?? "").trim();
    const distributionDate = distributionDateRaw ? new Date(distributionDateRaw) : null;

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!recipientName) {
      throw VALIDATION_ERROR("수령자는 필수입니다.");
    }
    if (!distributionDate || Number.isNaN(distributionDate.getTime())) {
      throw VALIDATION_ERROR("지급일 형식이 올바르지 않습니다.");
    }

    const rawItems = Array.isArray(body.items)
      ? (body.items as Record<string, unknown>[])
      : [
          {
            itemName: body.itemName,
            specification: body.specification,
            quantity: body.quantity,
            unit: body.unit,
          },
        ];

    const items: PPEBatchItem[] = rawItems.map((item, index) => {
      const itemName = String(item.itemName ?? "").trim();
      const quantity = Number(item.quantity ?? 0);
      const unitRaw = String(item.unit ?? "").trim();

      if (!isPPEItemName(itemName)) {
        throw VALIDATION_ERROR(`${index + 1}번째 보호구 품목 값이 올바르지 않습니다.`);
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw VALIDATION_ERROR(`${index + 1}번째 수량은 1 이상이어야 합니다.`);
      }

      const unit = unitRaw || DEFAULT_PPE_UNIT_BY_ITEM[itemName];
      if (!isPPEUnit(unit)) {
        throw VALIDATION_ERROR(`${index + 1}번째 단위 값이 올바르지 않습니다.`);
      }

      return {
        itemName,
        specification: String(item.specification ?? "").trim(),
        quantity,
        unit,
      };
    });

    if (items.length === 0) {
      throw VALIDATION_ERROR("지급 품목을 1개 이상 추가해 주세요.");
    }

    const docs = await PPEDistributionRecord.insertMany(
      items.map((item) => ({
        siteId,
        recipientName,
        recipientCompany,
        distributionDate,
        ...item,
      })),
    );

    await Promise.all(
      docs.map((doc) =>
        logCreate(siteId, "safety_ppe", String(doc._id), { userId: null, userName: "system" }),
      ),
    );

    return success({ insertedCount: docs.length, data: docs });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SafetyMileageRecord from "@/models/SafetyMileageRecord";
import SiteMembership from "@/models/SiteMembership";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import { isSafetyMileageCategory, normalizeSafetyMileageCategory } from "@/lib/safety-mileage-category";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get("siteId");
    if (!siteId) throw VALIDATION_ERROR("siteId가 필요합니다.");
    const mode = String(searchParams.get("mode") ?? "").trim();

    if (mode === "summary") {
      const summary = await SafetyMileageRecord.aggregate([
        {
          $match: {
            siteId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: {
              $ifNull: ["$userId", { $ifNull: ["$recipientName", "$managerName"] }],
            },
            recipientName: {
              $first: { $ifNull: ["$recipientName", "$managerName"] },
            },
            cumulativePoints: { $sum: { $ifNull: ["$points", 1] } },
            lastRecordDate: { $max: "$recordDate" },
          },
        },
        {
          $project: {
            _id: 0,
            recipientKey: { $toString: "$_id" },
            recipientName: 1,
            cumulativePoints: 1,
            lastRecordDate: 1,
          },
        },
        {
          $sort: {
            cumulativePoints: -1,
            recipientName: 1,
          },
        },
      ]);

      return success(summary);
    }

    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      SafetyMileageRecord.find({ siteId }).sort({ recordDate: -1 }).skip(skip).limit(limit),
      SafetyMileageRecord.countDocuments({ siteId }),
    ]);

    const normalized = data.map((item) => {
      const record = item.toObject();
      return {
        ...record,
        userId: record.userId ? String(record.userId) : "",
        recipientName: record.recipientName ?? record.managerName ?? "",
      };
    });

    return paginated(normalized, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = (await request.json()) as Record<string, unknown>;
    const siteId = String(body.siteId ?? "").trim();
    const userId = String(body.userId ?? "").trim();
    const category = String(body.category ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw VALIDATION_ERROR("수여대상을 선택하세요.");
    }
    if (!isSafetyMileageCategory(category)) {
      throw VALIDATION_ERROR("분류 값이 올바르지 않습니다.");
    }

    const membership = await SiteMembership.findOne({
      siteId: new mongoose.Types.ObjectId(siteId),
      isActive: true,
      isDeleted: false,
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate("userId", "name email role isActive isDeleted")
      .select({ userId: 1, role: 1 })
      .lean();

    const user =
      membership?.userId && typeof membership.userId === "object"
        ? (membership.userId as {
            _id?: unknown;
            name?: string;
            email?: string;
            role?: "super_admin" | "site_admin" | "manager" | "viewer";
            isActive?: boolean;
            isDeleted?: boolean;
          })
        : null;

    if (!membership || !user?._id || !user.name || !user.isActive || user.isDeleted) {
      throw VALIDATION_ERROR("현재 현장에 배치된 사용자만 선택할 수 있습니다.");
    }

    const doc = await SafetyMileageRecord.create({
      ...body,
      siteId,
      userId: new mongoose.Types.ObjectId(String(user._id)),
      category: normalizeSafetyMileageCategory(category),
      points: 1,
      recipientName: String(user.name ?? "").trim(),
      recipientEmail: String(user.email ?? "").trim(),
      membershipRole: membership.role,
      systemRole: user.role ?? "viewer",
      managerName: String(user.name ?? "").trim(),
    });

    await logCreate(siteId, "safety_mileage", String(doc._id), { userId: null, userName: "system" });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

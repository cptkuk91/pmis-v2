import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import EmergencyContact from "@/models/EmergencyContact";
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
    const limit = Number(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      EmergencyContact.find({ siteId }).sort({ category: 1, sortOrder: 1 }).skip(skip).limit(limit),
      EmergencyContact.countDocuments({ siteId }),
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
    const doc = await EmergencyContact.create(body);
    await logCreate(body.siteId || "", "emergency_contact", String(doc._id), { userId: null, userName: "system" });
    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

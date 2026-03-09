import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import AccidentRecord from "@/models/AccidentRecord";
import { success, paginated } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";
import { isAccidentType } from "@/lib/accident-type";

function isSeverity(value: string): value is "minor" | "moderate" | "serious" | "fatal" {
  return value === "minor" || value === "moderate" || value === "serious" || value === "fatal";
}

function isStatus(value: string): value is "reported" | "investigating" | "closed" {
  return value === "reported" || value === "investigating" || value === "closed";
}

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
      AccidentRecord.find({ siteId }).sort({ accidentDate: -1 }).skip(skip).limit(limit),
      AccidentRecord.countDocuments({ siteId }),
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
    const accidentType = String(body.accidentType ?? "").trim();
    const severity = String(body.severity ?? "minor").trim();
    const status = String(body.status ?? "reported").trim();

    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }
    if (!isAccidentType(accidentType)) {
      throw VALIDATION_ERROR("사고 유형 값이 올바르지 않습니다.");
    }
    if (!isSeverity(severity)) {
      throw VALIDATION_ERROR("심각도 값이 올바르지 않습니다.");
    }
    if (!isStatus(status)) {
      throw VALIDATION_ERROR("상태 값이 올바르지 않습니다.");
    }

    const doc = await AccidentRecord.create(body);

    await logCreate(siteId, "safety_completion", String(doc._id), { userId: null, userName: "system" });

    return success(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

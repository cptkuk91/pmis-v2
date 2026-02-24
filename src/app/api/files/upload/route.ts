import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import FileAsset from "@/models/FileAsset";
import Site from "@/models/Site";
import User from "@/models/User";
import { success } from "@/lib/api-response";
import { handleApiError, ApiError } from "@/lib/api-error";
import { logCreate } from "@/lib/audit-logger";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const moduleName = (formData.get("module") as string) || "general";
    const requestedSiteId = formData.get("siteId") as string | null;
    const requestedUploadedBy = formData.get("uploadedBy") as string | null;

    if (!file) {
      throw new ApiError("파일이 필요합니다.", 400, "VALIDATION_ERROR");
    }
    let siteId = requestedSiteId;
    if (!siteId || !mongoose.Types.ObjectId.isValid(siteId)) {
      const firstSite = await Site.findOne().sort({ createdAt: 1 }).select({ _id: 1 }).lean();
      siteId = firstSite?._id ? String(firstSite._id) : null;
    }
    if (!siteId) {
      throw new ApiError("유효한 siteId를 찾을 수 없습니다.", 400, "VALIDATION_ERROR");
    }

    let uploadedBy = requestedUploadedBy;
    if (!uploadedBy || !mongoose.Types.ObjectId.isValid(uploadedBy)) {
      const firstUser = await User.findOne().sort({ createdAt: 1 }).select({ _id: 1 }).lean();
      uploadedBy = firstUser?._id ? String(firstUser._id) : "000000000000000000000000";
    }

    // storagePath: module/yyyy/mm/uuid.ext
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const ext = path.extname(file.name);
    const uuid = crypto.randomUUID();
    const storagePath = `${moduleName}/${yyyy}/${mm}/${uuid}${ext}`;

    // 로컬 저장 (개발 환경)
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      moduleName,
      yyyy,
      mm,
    );
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, `${uuid}${ext}`), buffer);

    // FileAsset 레코드 생성
    const fileAsset = await FileAsset.create({
      siteId,
      module: moduleName,
      originalName: file.name,
      storagePath,
      mimeType: file.type,
      size: file.size,
      uploadedBy,
    });

    await logCreate(siteId, "file_upload", String(fileAsset._id), { userId: null, userName: "system" });
    return success({
      fileAssetId: fileAsset._id,
      originalName: fileAsset.originalName,
      storagePath: fileAsset.storagePath,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

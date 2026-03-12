import mongoose from "mongoose";
import FileAsset from "@/models/FileAsset";
import { buildUploadUrl } from "@/lib/file-asset-url";

type FileAssetLink = {
  originalName: string;
  storagePath: string;
  url: string;
};

export async function getFileAssetLinkMap(
  siteId: string,
  ids: Array<string | mongoose.Types.ObjectId | null | undefined>,
) {
  const uniqueIds = Array.from(
    new Set(
      ids
        .map((value) => String(value ?? "").trim())
        .filter((value) => mongoose.Types.ObjectId.isValid(value)),
    ),
  );

  if (!uniqueIds.length) {
    return new Map<string, FileAssetLink>();
  }

  const assets = await FileAsset.find({
    _id: { $in: uniqueIds.map((value) => new mongoose.Types.ObjectId(value)) },
    siteId,
  })
    .select({ originalName: 1, storagePath: 1 })
    .lean<Array<{ _id: unknown; originalName?: string; storagePath?: string }>>();

  return new Map<string, FileAssetLink>(
    assets.map((asset) => {
      const storagePath = asset.storagePath ?? "";
      return [
        String(asset._id),
        {
          originalName: asset.originalName ?? "",
          storagePath,
          url: buildUploadUrl(storagePath),
        },
      ];
    }),
  );
}

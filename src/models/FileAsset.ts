import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IFileAsset extends Document {
  siteId: mongoose.Types.ObjectId;
  module: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  uploadedBy: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IFileAsset>;
}

const FileAssetSchema = new Schema<IFileAsset>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    module: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

FileAssetSchema.plugin(baseFieldsPlugin);

const FileAsset: Model<IFileAsset> =
  mongoose.models.FileAsset ||
  mongoose.model<IFileAsset>("FileAsset", FileAssetSchema);

export default FileAsset;

import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IProgressPhoto extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  shotDate: Date;
  location: string;
  description: string;
  progressRate: number;
  fileAssetId?: mongoose.Types.ObjectId;
  uploadedByName: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IProgressPhoto>;
}

const ProgressPhotoSchema = new Schema<IProgressPhoto>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    title: { type: String, required: true, trim: true },
    shotDate: { type: Date, required: true, index: true },
    location: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    progressRate: { type: Number, default: 0, min: 0, max: 100 },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    uploadedByName: { type: String, default: "현장관리자", trim: true },
  },
  { timestamps: true },
);

ProgressPhotoSchema.index({ siteId: 1, shotDate: -1 });
ProgressPhotoSchema.plugin(baseFieldsPlugin);

const ProgressPhoto: Model<IProgressPhoto> =
  mongoose.models.ProgressPhoto ||
  mongoose.model<IProgressPhoto>("ProgressPhoto", ProgressPhotoSchema);

export default ProgressPhoto;

import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IMaterialInspection extends Document {
  siteId: mongoose.Types.ObjectId;
  materialName: string;
  specification?: string;
  supplier?: string;
  quantity: number;
  unit: string;
  inspectionDate: Date;
  result: "pass" | "fail" | "pending";
  inspector?: string;
  remarks?: string;
  fileAssetId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IMaterialInspection>;
}

const MaterialInspectionSchema = new Schema<IMaterialInspection>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    materialName: { type: String, required: true, trim: true },
    specification: { type: String, trim: true },
    supplier: { type: String, trim: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    inspectionDate: { type: Date, required: true },
    result: {
      type: String,
      enum: ["pass", "fail", "pending"],
      default: "pending",
    },
    inspector: { type: String, trim: true },
    remarks: { type: String },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
  },
  { timestamps: true },
);

MaterialInspectionSchema.index({ siteId: 1, inspectionDate: -1 });
MaterialInspectionSchema.plugin(baseFieldsPlugin);

const MaterialInspection: Model<IMaterialInspection> =
  mongoose.models.MaterialInspection ||
  mongoose.model<IMaterialInspection>("MaterialInspection", MaterialInspectionSchema);

export default MaterialInspection;

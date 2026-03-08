import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyDocument extends Document {
  siteId: string;
  docType: "hazard" | "plan" | "partner";
  title: string;
  description: string;
  fileAssetId?: mongoose.Types.ObjectId;
  version: number;
  status: "draft" | "in_review" | "approved" | "rejected";
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISafetyDocument>;
}

const SafetyDocumentSchema = new Schema<ISafetyDocument>(
  {
    siteId: { type: String, required: true, index: true },
    docType: { type: String, enum: ["hazard", "plan", "partner"], required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ["draft", "in_review", "approved", "rejected"], default: "draft" },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "safety_documents" },
);

SafetyDocumentSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyDocument || mongoose.model<ISafetyDocument>("SafetyDocument", SafetyDocumentSchema);

import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IConstructionPlan extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  category?: string;
  description?: string;
  fileAssetId?: mongoose.Types.ObjectId;
  version?: string;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IConstructionPlan>;
}

const ConstructionPlanSchema = new Schema<IConstructionPlan>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    description: { type: String },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
    version: { type: String, trim: true },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

ConstructionPlanSchema.index({ siteId: 1, createdAt: -1 });
ConstructionPlanSchema.plugin(baseFieldsPlugin);

const ConstructionPlan: Model<IConstructionPlan> =
  mongoose.models.ConstructionPlan ||
  mongoose.model<IConstructionPlan>("ConstructionPlan", ConstructionPlanSchema);

export default ConstructionPlan;

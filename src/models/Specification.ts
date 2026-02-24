import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISpecification extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  category?: string;
  description?: string;
  fileAssetId?: mongoose.Types.ObjectId;
  version?: string;
  effectiveDate?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISpecification>;
}

const SpecificationSchema = new Schema<ISpecification>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    description: { type: String },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
    version: { type: String, trim: true },
    effectiveDate: { type: Date },
  },
  { timestamps: true },
);

SpecificationSchema.index({ siteId: 1, createdAt: -1 });
SpecificationSchema.plugin(baseFieldsPlugin);

const Specification: Model<ISpecification> =
  mongoose.models.Specification ||
  mongoose.model<ISpecification>("Specification", SpecificationSchema);

export default Specification;

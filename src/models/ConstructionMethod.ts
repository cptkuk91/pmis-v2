import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IConstructionMethod extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  workType?: string;
  description?: string;
  fileAssetId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IConstructionMethod>;
}

const ConstructionMethodSchema = new Schema<IConstructionMethod>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    title: { type: String, required: true, trim: true },
    workType: { type: String, trim: true },
    description: { type: String },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
  },
  { timestamps: true },
);

ConstructionMethodSchema.index({ siteId: 1 });
ConstructionMethodSchema.plugin(baseFieldsPlugin);

const ConstructionMethod: Model<IConstructionMethod> =
  mongoose.models.ConstructionMethod ||
  mongoose.model<IConstructionMethod>(
    "ConstructionMethod",
    ConstructionMethodSchema,
  );

export default ConstructionMethod;

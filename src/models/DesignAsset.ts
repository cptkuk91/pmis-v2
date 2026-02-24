import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IDesignAsset extends Document {
  siteId: mongoose.Types.ObjectId;
  nodeId: mongoose.Types.ObjectId;
  assetCode: string;
  assetName: string;
  revision: string;
  fileAssetId?: mongoose.Types.ObjectId;
  notes: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDesignAsset>;
}

const DesignAssetSchema = new Schema<IDesignAsset>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    nodeId: { type: Schema.Types.ObjectId, ref: "DesignTreeNode", required: true, index: true },
    assetCode: { type: String, required: true, trim: true },
    assetName: { type: String, required: true, trim: true },
    revision: { type: String, default: "0", trim: true },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

DesignAssetSchema.index({ siteId: 1, nodeId: 1, assetCode: 1 }, { unique: true });
DesignAssetSchema.index({ siteId: 1, nodeId: 1, createdAt: -1 });
DesignAssetSchema.plugin(baseFieldsPlugin);

const DesignAsset: Model<IDesignAsset> =
  mongoose.models.DesignAsset ||
  mongoose.model<IDesignAsset>("DesignAsset", DesignAssetSchema);

export default DesignAsset;

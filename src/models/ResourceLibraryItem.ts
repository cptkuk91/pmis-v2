import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IResourceLibraryItem extends Document {
  siteId: mongoose.Types.ObjectId;
  categoryCode: string;
  title: string;
  description: string;
  authorName: string;
  fileAssetId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IResourceLibraryItem>;
}

const ResourceLibraryItemSchema = new Schema<IResourceLibraryItem>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    categoryCode: { type: String, required: true, trim: true, default: "GENERAL" },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    authorName: { type: String, required: true, trim: true, default: "관리자" },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
  },
  { timestamps: true },
);

ResourceLibraryItemSchema.index({ siteId: 1, createdAt: -1 });
ResourceLibraryItemSchema.plugin(baseFieldsPlugin);

const ResourceLibraryItem: Model<IResourceLibraryItem> =
  mongoose.models.ResourceLibraryItem ||
  mongoose.model<IResourceLibraryItem>("ResourceLibraryItem", ResourceLibraryItemSchema);

export default ResourceLibraryItem;

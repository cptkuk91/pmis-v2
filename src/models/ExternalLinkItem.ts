import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IExternalLinkItem extends Document {
  siteId?: mongoose.Types.ObjectId;
  category: "laws" | "ks" | "pro-sites" | "general";
  name: string;
  url: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IExternalLinkItem>;
}

const ExternalLinkItemSchema = new Schema<IExternalLinkItem>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", default: null, index: true },
    category: {
      type: String,
      enum: ["laws", "ks", "pro-sites", "general"],
      default: "general",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

ExternalLinkItemSchema.index({ category: 1, sortOrder: 1 });
ExternalLinkItemSchema.plugin(baseFieldsPlugin);

const ExternalLinkItem: Model<IExternalLinkItem> =
  mongoose.models.ExternalLinkItem ||
  mongoose.model<IExternalLinkItem>("ExternalLinkItem", ExternalLinkItemSchema);

export default ExternalLinkItem;

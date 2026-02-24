import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ICodeItem extends Document {
  siteId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  itemCode: string;
  itemName: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ICodeItem>;
}

const CodeItemSchema = new Schema<ICodeItem>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    groupId: { type: Schema.Types.ObjectId, ref: "CodeGroup", required: true },
    itemCode: { type: String, required: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    description: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CodeItemSchema.index({ groupId: 1, itemCode: 1 }, { unique: true });
CodeItemSchema.plugin(baseFieldsPlugin);

const CodeItem: Model<ICodeItem> =
  mongoose.models.CodeItem ||
  mongoose.model<ICodeItem>("CodeItem", CodeItemSchema);

export default CodeItem;

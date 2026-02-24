import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IDocumentSystemItem extends Document {
  siteId: mongoose.Types.ObjectId;
  itemCode: string;
  itemName: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDocumentSystemItem>;
}

const DocumentSystemItemSchema = new Schema<IDocumentSystemItem>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    itemCode: { type: String, required: true, trim: true, uppercase: true },
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

DocumentSystemItemSchema.index({ siteId: 1, itemCode: 1 }, { unique: true });
DocumentSystemItemSchema.index({ siteId: 1, sortOrder: 1 });
DocumentSystemItemSchema.plugin(baseFieldsPlugin);

const DocumentSystemItem: Model<IDocumentSystemItem> =
  mongoose.models.DocumentSystemItem ||
  mongoose.model<IDocumentSystemItem>("DocumentSystemItem", DocumentSystemItemSchema);

export default DocumentSystemItem;

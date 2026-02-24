import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IDocumentCategory extends Document {
  siteId: mongoose.Types.ObjectId;
  categoryCode: string;
  categoryName: string;
  parentCategoryId?: mongoose.Types.ObjectId;
  sortOrder: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDocumentCategory>;
}

const DocumentCategorySchema = new Schema<IDocumentCategory>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    categoryCode: { type: String, required: true, trim: true, uppercase: true },
    categoryName: { type: String, required: true, trim: true },
    parentCategoryId: { type: Schema.Types.ObjectId, ref: "DocumentCategory", default: null, index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

DocumentCategorySchema.index({ siteId: 1, categoryCode: 1 }, { unique: true });
DocumentCategorySchema.index({ siteId: 1, parentCategoryId: 1, sortOrder: 1 });
DocumentCategorySchema.plugin(baseFieldsPlugin);

const DocumentCategory: Model<IDocumentCategory> =
  mongoose.models.DocumentCategory ||
  mongoose.model<IDocumentCategory>("DocumentCategory", DocumentCategorySchema);

export default DocumentCategory;

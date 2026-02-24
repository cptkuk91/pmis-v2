import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IDocumentAttachment extends Document {
  siteId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  sortOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDocumentAttachment>;
}

const DocumentAttachmentSchema = new Schema<IDocumentAttachment>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", required: true },
    fileName: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

DocumentAttachmentSchema.index({ siteId: 1, documentId: 1, sortOrder: 1 });
DocumentAttachmentSchema.plugin(baseFieldsPlugin);

const DocumentAttachment: Model<IDocumentAttachment> =
  mongoose.models.DocumentAttachment ||
  mongoose.model<IDocumentAttachment>("DocumentAttachment", DocumentAttachmentSchema);

export default DocumentAttachment;

import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface IDocumentApprovalLine extends Document {
  siteId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  order: number;
  approverId?: mongoose.Types.ObjectId;
  approverName: string;
  approverRoleTitle: string;
  status: ApprovalStatus;
  actedAt?: Date;
  comment: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDocumentApprovalLine>;
}

const DocumentApprovalLineSchema = new Schema<IDocumentApprovalLine>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    order: { type: Number, required: true, min: 1 },
    approverId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approverName: { type: String, required: true, trim: true },
    approverRoleTitle: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    actedAt: { type: Date, default: null },
    comment: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

DocumentApprovalLineSchema.index({ siteId: 1, documentId: 1, order: 1 }, { unique: true });
DocumentApprovalLineSchema.index({ siteId: 1, approverName: 1, status: 1 });
DocumentApprovalLineSchema.plugin(baseFieldsPlugin);

const DocumentApprovalLine: Model<IDocumentApprovalLine> =
  mongoose.models.DocumentApprovalLine ||
  mongoose.model<IDocumentApprovalLine>("DocumentApprovalLine", DocumentApprovalLineSchema);

export default DocumentApprovalLine;

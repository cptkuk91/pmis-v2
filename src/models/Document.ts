import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import type { Status } from "@/types";

export type DocumentLedgerType = "instruction" | "outbound" | "inbound" | "general";
export type DocumentDirection = "outbound" | "inbound" | "internal";

export interface IDocument extends Document {
  siteId: mongoose.Types.ObjectId;
  docNo: string;
  title: string;
  content: string;
  ledgerType: DocumentLedgerType;
  direction: DocumentDirection;
  status: Status;
  categoryCode: string;
  senderName: string;
  receiverName: string;
  draftByName: string;
  submittedAt?: Date;
  sentAt?: Date;
  receivedAt?: Date;
  completedAt?: Date;
  currentApprovalOrder: number;
  finalApproverName: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDocument>;
}

const DocumentSchema = new Schema<IDocument>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    docNo: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "", trim: true },
    ledgerType: {
      type: String,
      enum: ["instruction", "outbound", "inbound", "general"],
      default: "general",
      index: true,
    },
    direction: {
      type: String,
      enum: ["outbound", "inbound", "internal"],
      default: "internal",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "rejected", "completed"],
      default: "draft",
      index: true,
    },
    categoryCode: { type: String, default: "", trim: true },
    senderName: { type: String, default: "", trim: true },
    receiverName: { type: String, default: "", trim: true },
    draftByName: { type: String, default: "", trim: true },
    submittedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    currentApprovalOrder: { type: Number, default: 0 },
    finalApproverName: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

DocumentSchema.index({ siteId: 1, docNo: 1 }, { unique: true });
DocumentSchema.index({ siteId: 1, ledgerType: 1, createdAt: -1 });
DocumentSchema.index({ siteId: 1, direction: 1, createdAt: -1 });
DocumentSchema.index({ siteId: 1, status: 1, updatedAt: -1 });
DocumentSchema.plugin(baseFieldsPlugin);

const DocumentModel: Model<IDocument> =
  mongoose.models.Document || mongoose.model<IDocument>("Document", DocumentSchema);

export default DocumentModel;

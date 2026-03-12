import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QA_CAPA_ACTION_TYPE_VALUES,
  QA_CAPA_PRIORITY_VALUES,
  QA_CAPA_SOURCE_TYPE_VALUES,
  QA_CAPA_STATUS_VALUES,
  type QaCapaActionType,
  type QaCapaPriority,
  type QaCapaSourceType,
  type QaCapaStatus,
} from "@/lib/qa-capa";

export interface IQaCapa extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  sourceType: QaCapaSourceType;
  sourceSummary: string;
  sourceAuditId: string;
  sourceAuditTitle: string;
  sourceChecklistId: string;
  sourceChecklistSection: string;
  sourceChecklistTitle: string;
  actionType: QaCapaActionType;
  priority: QaCapaPriority;
  status: QaCapaStatus;
  rootCauseSummary: string;
  whyAnalysis: string[];
  actionPlan: string;
  executionNote: string;
  assigneeName: string;
  assigneeMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  dueDate: Date;
  verifiedAt?: Date | null;
  verificationNote: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQaCapa>;
}

const QaCapaSchema = new Schema<IQaCapa>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    title: { type: String, required: true, trim: true },
    sourceType: {
      type: String,
      enum: QA_CAPA_SOURCE_TYPE_VALUES,
      required: true,
      default: "manual",
      index: true,
    },
    sourceSummary: { type: String, default: "", trim: true },
    sourceAuditId: { type: String, default: "", trim: true },
    sourceAuditTitle: { type: String, default: "", trim: true },
    sourceChecklistId: { type: String, default: "", trim: true },
    sourceChecklistSection: { type: String, default: "", trim: true },
    sourceChecklistTitle: { type: String, default: "", trim: true },
    actionType: {
      type: String,
      enum: QA_CAPA_ACTION_TYPE_VALUES,
      required: true,
      default: "corrective",
      index: true,
    },
    priority: {
      type: String,
      enum: QA_CAPA_PRIORITY_VALUES,
      required: true,
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: QA_CAPA_STATUS_VALUES,
      required: true,
      default: "open",
      index: true,
    },
    rootCauseSummary: { type: String, required: true, trim: true },
    whyAnalysis: { type: [String], default: [] },
    actionPlan: { type: String, required: true, trim: true },
    executionNote: { type: String, default: "", trim: true },
    assigneeName: { type: String, required: true, trim: true },
    assigneeMemberId: { type: String, required: true, trim: true, index: true },
    verifierName: { type: String, default: "", trim: true },
    verifierMemberId: { type: String, default: "", trim: true },
    dueDate: { type: Date, required: true, index: true },
    verifiedAt: { type: Date, default: null },
    verificationNote: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "qa_capa" },
);

QaCapaSchema.index({ siteId: 1, status: 1, dueDate: 1, createdAt: -1 });
QaCapaSchema.index({ siteId: 1, priority: 1, dueDate: 1 });
QaCapaSchema.index({ siteId: 1, sourceType: 1, createdAt: -1 });
QaCapaSchema.plugin(baseFieldsPlugin);

const QaCapa: Model<IQaCapa> = mongoose.models.QaCapa || mongoose.model<IQaCapa>("QaCapa", QaCapaSchema);

export default QaCapa;

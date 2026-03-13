import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import { QC_ATTACHMENT_CATEGORY_VALUES, type QcAttachmentCategory } from "@/lib/qc-core";
import {
  QC_NONCONFORMANCE_HISTORY_ACTION_VALUES,
  QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES,
  QC_NONCONFORMANCE_SEVERITY_VALUES,
  QC_NONCONFORMANCE_SOURCE_TYPE_VALUES,
  QC_NONCONFORMANCE_STATUS_VALUES,
  QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES,
  type QcNonconformanceHistoryAction,
  type QcNonconformanceOccurrenceType,
  type QcNonconformanceSeverity,
  type QcNonconformanceSourceType,
  type QcNonconformanceStatus,
  type QcNonconformanceVerificationResult,
} from "@/lib/qc-nonconformance";

export interface IQcNonconformanceAttachment {
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
}

export interface IQcNonconformanceHistoryEntry {
  actionType: QcNonconformanceHistoryAction;
  status: QcNonconformanceStatus;
  verificationResult: QcNonconformanceVerificationResult;
  note: string;
  actorName: string;
  actionDate: Date;
}

export interface IQcNonconformance extends Document {
  siteId: mongoose.Types.ObjectId;
  ncrNo: string;
  occurrenceType: QcNonconformanceOccurrenceType;
  sourceType: QcNonconformanceSourceType;
  severity: QcNonconformanceSeverity;
  severityRank: number;
  title: string;
  description: string;
  occurrenceDate: Date;
  location: string;
  workType: string;
  sourceSummary: string;
  linkedMaterialInspectionId?: mongoose.Types.ObjectId;
  linkedMaterialInspectionTitle: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId;
  linkedProcessInspectionTitle: string;
  linkedTestReportId?: mongoose.Types.ObjectId;
  linkedTestReportTitle: string;
  reporterName: string;
  assigneeName: string;
  assigneeMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  dueDate: Date;
  status: QcNonconformanceStatus;
  rootCauseSummary: string;
  containmentAction: string;
  correctiveActionPlan: string;
  preventiveAction: string;
  actionTaken: string;
  verificationResult: QcNonconformanceVerificationResult;
  verificationNote: string;
  verifiedAt?: Date | null;
  closedAt?: Date | null;
  attachments: IQcNonconformanceAttachment[];
  history: IQcNonconformanceHistoryEntry[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQcNonconformance>;
}

const AttachmentSchema = new Schema<IQcNonconformanceAttachment>(
  {
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", required: true },
    fileName: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: QC_ATTACHMENT_CATEGORY_VALUES,
      default: "other",
      required: true,
    },
    sortOrder: { type: Number, default: 0, required: true },
  },
  { _id: false },
);

const HistorySchema = new Schema<IQcNonconformanceHistoryEntry>(
  {
    actionType: {
      type: String,
      enum: QC_NONCONFORMANCE_HISTORY_ACTION_VALUES,
      required: true,
    },
    status: {
      type: String,
      enum: QC_NONCONFORMANCE_STATUS_VALUES,
      required: true,
    },
    verificationResult: {
      type: String,
      enum: QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES,
      default: "pending",
      required: true,
    },
    note: { type: String, default: "", trim: true },
    actorName: { type: String, default: "", trim: true },
    actionDate: { type: Date, default: Date.now, required: true },
  },
  { _id: false },
);

const QcNonconformanceSchema = new Schema<IQcNonconformance>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    ncrNo: { type: String, required: true, trim: true },
    occurrenceType: {
      type: String,
      enum: QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES,
      default: "other",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: QC_NONCONFORMANCE_SOURCE_TYPE_VALUES,
      default: "manual",
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: QC_NONCONFORMANCE_SEVERITY_VALUES,
      default: "medium",
      required: true,
      index: true,
    },
    severityRank: { type: Number, required: true, default: 2, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    occurrenceDate: { type: Date, required: true, index: true },
    location: { type: String, default: "", trim: true },
    workType: { type: String, default: "", trim: true },
    sourceSummary: { type: String, default: "", trim: true },
    linkedMaterialInspectionId: { type: Schema.Types.ObjectId, ref: "MaterialInspection" },
    linkedMaterialInspectionTitle: { type: String, default: "", trim: true },
    linkedProcessInspectionId: { type: Schema.Types.ObjectId, ref: "QcProcessInspection" },
    linkedProcessInspectionTitle: { type: String, default: "", trim: true },
    linkedTestReportId: { type: Schema.Types.ObjectId, ref: "QcTestReport" },
    linkedTestReportTitle: { type: String, default: "", trim: true },
    reporterName: { type: String, default: "", trim: true },
    assigneeName: { type: String, default: "", trim: true },
    assigneeMemberId: { type: String, default: "", trim: true },
    verifierName: { type: String, default: "", trim: true },
    verifierMemberId: { type: String, default: "", trim: true },
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: QC_NONCONFORMANCE_STATUS_VALUES,
      default: "open",
      required: true,
      index: true,
    },
    rootCauseSummary: { type: String, default: "", trim: true },
    containmentAction: { type: String, default: "", trim: true },
    correctiveActionPlan: { type: String, default: "", trim: true },
    preventiveAction: { type: String, default: "", trim: true },
    actionTaken: { type: String, default: "", trim: true },
    verificationResult: {
      type: String,
      enum: QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES,
      default: "pending",
      required: true,
      index: true,
    },
    verificationNote: { type: String, default: "", trim: true },
    verifiedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    attachments: { type: [AttachmentSchema], default: [] },
    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true, collection: "qc_nonconformances" },
);

QcNonconformanceSchema.index({ siteId: 1, ncrNo: 1 }, { unique: true });
QcNonconformanceSchema.index({ siteId: 1, status: 1, dueDate: 1 });
QcNonconformanceSchema.index({ siteId: 1, severityRank: -1, dueDate: 1 });
QcNonconformanceSchema.index({ siteId: 1, sourceType: 1, occurrenceDate: -1 });
QcNonconformanceSchema.index({ siteId: 1, linkedMaterialInspectionId: 1 });
QcNonconformanceSchema.index({ siteId: 1, linkedProcessInspectionId: 1 });
QcNonconformanceSchema.index({ siteId: 1, linkedTestReportId: 1 });
QcNonconformanceSchema.plugin(baseFieldsPlugin);

const QcNonconformance: Model<IQcNonconformance> =
  mongoose.models.QcNonconformance ||
  mongoose.model<IQcNonconformance>("QcNonconformance", QcNonconformanceSchema);

export default QcNonconformance;

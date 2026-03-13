import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import { QC_ATTACHMENT_CATEGORY_VALUES, type QcAttachmentCategory } from "@/lib/qc-core";
import {
  QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES,
  QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES,
  QC_PROCESS_INSPECTION_HISTORY_ACTION_VALUES,
  QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES,
  QC_PROCESS_INSPECTION_RESULT_VALUES,
  QC_PROCESS_INSPECTION_STATUS_VALUES,
  type QcProcessInspectionCheckStatus,
  type QcProcessInspectionCorrectiveActionStatus,
  type QcProcessInspectionHistoryAction,
  type QcProcessInspectionIssueStatus,
  type QcProcessInspectionResult,
  type QcProcessInspectionStatus,
} from "@/lib/qc-process-inspections";

export interface IQcProcessInspectionAttachment {
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
}

export interface IQcProcessInspectionChecklistItem {
  itemId: string;
  label: string;
  status: QcProcessInspectionCheckStatus;
  note: string;
}

export interface IQcProcessInspectionHistoryEntry {
  actionType: QcProcessInspectionHistoryAction;
  status: QcProcessInspectionStatus;
  correctiveActionStatus: QcProcessInspectionCorrectiveActionStatus;
  note: string;
  actorName: string;
  actionDate: Date;
}

export interface IQcProcessInspection extends Document {
  siteId: mongoose.Types.ObjectId;
  workType: string;
  location: string;
  processStep: string;
  inspectionTitle: string;
  plannedInspectionDate: Date;
  actualInspectionDate?: Date;
  status: QcProcessInspectionStatus;
  result: QcProcessInspectionResult;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  linkedItpPlanId?: mongoose.Types.ObjectId;
  linkedItpPlanTitle?: string;
  linkedItpCheckpointId?: string;
  linkedItpCheckpointTitle?: string;
  acceptanceCriteria: string;
  checklistItems: IQcProcessInspectionChecklistItem[];
  inspectionNotes: string;
  correctiveActionStatus: QcProcessInspectionCorrectiveActionStatus;
  correctiveActionRequest: string;
  correctiveActionDueDate?: Date;
  correctiveActionSummary: string;
  attachments: IQcProcessInspectionAttachment[];
  issueStatus: QcProcessInspectionIssueStatus;
  issueReference: string;
  history: IQcProcessInspectionHistoryEntry[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQcProcessInspection>;
}

const QcProcessInspectionAttachmentSchema = new Schema<IQcProcessInspectionAttachment>(
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

const QcProcessInspectionChecklistItemSchema = new Schema<IQcProcessInspectionChecklistItem>(
  {
    itemId: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES,
      default: "pending",
      required: true,
    },
    note: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const QcProcessInspectionHistoryEntrySchema = new Schema<IQcProcessInspectionHistoryEntry>(
  {
    actionType: {
      type: String,
      enum: QC_PROCESS_INSPECTION_HISTORY_ACTION_VALUES,
      required: true,
    },
    status: {
      type: String,
      enum: QC_PROCESS_INSPECTION_STATUS_VALUES,
      required: true,
    },
    correctiveActionStatus: {
      type: String,
      enum: QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES,
      default: "none",
      required: true,
    },
    note: { type: String, default: "", trim: true },
    actorName: { type: String, default: "", trim: true },
    actionDate: { type: Date, default: Date.now, required: true },
  },
  { _id: false },
);

const QcProcessInspectionSchema = new Schema<IQcProcessInspection>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    workType: { type: String, required: true, trim: true, index: true },
    location: { type: String, required: true, trim: true, index: true },
    processStep: { type: String, required: true, trim: true },
    inspectionTitle: { type: String, required: true, trim: true },
    plannedInspectionDate: { type: Date, required: true, index: true },
    actualInspectionDate: { type: Date },
    status: {
      type: String,
      enum: QC_PROCESS_INSPECTION_STATUS_VALUES,
      default: "scheduled",
      required: true,
      index: true,
    },
    result: {
      type: String,
      enum: QC_PROCESS_INSPECTION_RESULT_VALUES,
      default: "pending",
      required: true,
      index: true,
    },
    requesterName: { type: String, default: "", trim: true },
    requesterMemberId: { type: String, default: "", trim: true },
    inspectorName: { type: String, default: "", trim: true },
    inspectorMemberId: { type: String, default: "", trim: true },
    verifierName: { type: String, default: "", trim: true },
    verifierMemberId: { type: String, default: "", trim: true },
    linkedItpPlanId: { type: Schema.Types.ObjectId, ref: "QcInspectionTestPlan" },
    linkedItpPlanTitle: { type: String, default: "", trim: true },
    linkedItpCheckpointId: { type: String, default: "", trim: true },
    linkedItpCheckpointTitle: { type: String, default: "", trim: true },
    acceptanceCriteria: { type: String, default: "", trim: true },
    checklistItems: { type: [QcProcessInspectionChecklistItemSchema], default: [] },
    inspectionNotes: { type: String, default: "", trim: true },
    correctiveActionStatus: {
      type: String,
      enum: QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES,
      default: "none",
      required: true,
      index: true,
    },
    correctiveActionRequest: { type: String, default: "", trim: true },
    correctiveActionDueDate: { type: Date },
    correctiveActionSummary: { type: String, default: "", trim: true },
    attachments: { type: [QcProcessInspectionAttachmentSchema], default: [] },
    issueStatus: {
      type: String,
      enum: QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES,
      default: "none",
      required: true,
      index: true,
    },
    issueReference: { type: String, default: "", trim: true },
    history: { type: [QcProcessInspectionHistoryEntrySchema], default: [] },
  },
  { timestamps: true, collection: "qc_process_inspections" },
);

QcProcessInspectionSchema.index({ siteId: 1, plannedInspectionDate: -1 });
QcProcessInspectionSchema.index({ siteId: 1, status: 1, plannedInspectionDate: -1 });
QcProcessInspectionSchema.index({ siteId: 1, correctiveActionStatus: 1, plannedInspectionDate: -1 });
QcProcessInspectionSchema.index({ siteId: 1, workType: 1, location: 1, plannedInspectionDate: -1 });
QcProcessInspectionSchema.index({ siteId: 1, linkedItpPlanId: 1, plannedInspectionDate: -1 });
QcProcessInspectionSchema.plugin(baseFieldsPlugin);

const QcProcessInspection: Model<IQcProcessInspection> =
  mongoose.models.QcProcessInspection ||
  mongoose.model<IQcProcessInspection>("QcProcessInspection", QcProcessInspectionSchema);

export default QcProcessInspection;

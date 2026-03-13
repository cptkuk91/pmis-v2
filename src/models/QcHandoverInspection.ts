import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import { QC_ATTACHMENT_CATEGORY_VALUES, type QcAttachmentCategory } from "@/lib/qc-core";
import {
  QC_HANDOVER_APPROVAL_STATUS_VALUES,
  QC_HANDOVER_AREA_TYPE_VALUES,
  QC_HANDOVER_CHECK_STATUS_VALUES,
  QC_HANDOVER_FINDING_STATUS_VALUES,
  QC_HANDOVER_HISTORY_ACTION_VALUES,
  QC_HANDOVER_INSPECTION_TYPE_VALUES,
  QC_HANDOVER_RESULT_VALUES,
  QC_HANDOVER_STATUS_VALUES,
  type QcHandoverApprovalStatus,
  type QcHandoverAreaType,
  type QcHandoverCheckStatus,
  type QcHandoverFindingStatus,
  type QcHandoverHistoryAction,
  type QcHandoverInspectionType,
  type QcHandoverResult,
  type QcHandoverStatus,
} from "@/lib/qc-handover-inspections";

export interface IQcHandoverInspectionAttachment {
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
}

export interface IQcHandoverInspectionChecklistItem {
  itemId: string;
  sectionTitle: string;
  checkpointTitle: string;
  spaceLabel: string;
  status: QcHandoverCheckStatus;
  note: string;
  findingTitle: string;
  correctiveRequest: string;
  correctiveDueDate?: Date | null;
  findingStatus: QcHandoverFindingStatus;
  completionNote: string;
}

export interface IQcHandoverInspectionHistoryEntry {
  actionType: QcHandoverHistoryAction;
  status: QcHandoverStatus;
  approvalStatus: QcHandoverApprovalStatus;
  note: string;
  actorName: string;
  actionDate: Date;
}

export interface IQcHandoverInspection extends Document {
  siteId: mongoose.Types.ObjectId;
  inspectionNo: string;
  inspectionType: QcHandoverInspectionType;
  inspectionTitle: string;
  workType: string;
  areaType: QcHandoverAreaType;
  areaLabel: string;
  unitNo: string;
  zoneName: string;
  plannedInspectionDate: Date;
  inspectedAt?: Date | null;
  status: QcHandoverStatus;
  result: QcHandoverResult;
  openFindingCount: number;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  approverName: string;
  approverMemberId: string;
  approvalStatus: QcHandoverApprovalStatus;
  approvedAt?: Date | null;
  approvalComment: string;
  inspectionSummary: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId | null;
  linkedProcessInspectionTitle: string;
  linkedNcrId?: mongoose.Types.ObjectId | null;
  linkedNcrNo: string;
  linkedNcrTitle: string;
  checklistItems: IQcHandoverInspectionChecklistItem[];
  attachments: IQcHandoverInspectionAttachment[];
  history: IQcHandoverInspectionHistoryEntry[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQcHandoverInspection>;
}

const AttachmentSchema = new Schema<IQcHandoverInspectionAttachment>(
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

const ChecklistItemSchema = new Schema<IQcHandoverInspectionChecklistItem>(
  {
    itemId: { type: String, required: true, trim: true },
    sectionTitle: { type: String, default: "", trim: true },
    checkpointTitle: { type: String, required: true, trim: true },
    spaceLabel: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: QC_HANDOVER_CHECK_STATUS_VALUES,
      default: "pending",
      required: true,
    },
    note: { type: String, default: "", trim: true },
    findingTitle: { type: String, default: "", trim: true },
    correctiveRequest: { type: String, default: "", trim: true },
    correctiveDueDate: { type: Date, default: null },
    findingStatus: {
      type: String,
      enum: QC_HANDOVER_FINDING_STATUS_VALUES,
      default: "none",
      required: true,
    },
    completionNote: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const HistorySchema = new Schema<IQcHandoverInspectionHistoryEntry>(
  {
    actionType: {
      type: String,
      enum: QC_HANDOVER_HISTORY_ACTION_VALUES,
      required: true,
    },
    status: {
      type: String,
      enum: QC_HANDOVER_STATUS_VALUES,
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: QC_HANDOVER_APPROVAL_STATUS_VALUES,
      default: "none",
      required: true,
    },
    note: { type: String, default: "", trim: true },
    actorName: { type: String, default: "", trim: true },
    actionDate: { type: Date, default: Date.now, required: true },
  },
  { _id: false },
);

const QcHandoverInspectionSchema = new Schema<IQcHandoverInspection>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    inspectionNo: { type: String, required: true, trim: true },
    inspectionType: {
      type: String,
      enum: QC_HANDOVER_INSPECTION_TYPE_VALUES,
      default: "acceptance",
      required: true,
      index: true,
    },
    inspectionTitle: { type: String, required: true, trim: true },
    workType: { type: String, required: true, trim: true, index: true },
    areaType: {
      type: String,
      enum: QC_HANDOVER_AREA_TYPE_VALUES,
      default: "space",
      required: true,
      index: true,
    },
    areaLabel: { type: String, default: "", trim: true, index: true },
    unitNo: { type: String, default: "", trim: true, index: true },
    zoneName: { type: String, default: "", trim: true, index: true },
    plannedInspectionDate: { type: Date, required: true, index: true },
    inspectedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: QC_HANDOVER_STATUS_VALUES,
      default: "scheduled",
      required: true,
      index: true,
    },
    result: {
      type: String,
      enum: QC_HANDOVER_RESULT_VALUES,
      default: "pending",
      required: true,
      index: true,
    },
    openFindingCount: { type: Number, default: 0, required: true, index: true },
    requesterName: { type: String, default: "", trim: true },
    requesterMemberId: { type: String, default: "", trim: true },
    inspectorName: { type: String, default: "", trim: true },
    inspectorMemberId: { type: String, default: "", trim: true },
    approverName: { type: String, default: "", trim: true },
    approverMemberId: { type: String, default: "", trim: true },
    approvalStatus: {
      type: String,
      enum: QC_HANDOVER_APPROVAL_STATUS_VALUES,
      default: "none",
      required: true,
      index: true,
    },
    approvedAt: { type: Date, default: null },
    approvalComment: { type: String, default: "", trim: true },
    inspectionSummary: { type: String, default: "", trim: true },
    linkedProcessInspectionId: { type: Schema.Types.ObjectId, ref: "QcProcessInspection" },
    linkedProcessInspectionTitle: { type: String, default: "", trim: true },
    linkedNcrId: { type: Schema.Types.ObjectId, ref: "QcNonconformance" },
    linkedNcrNo: { type: String, default: "", trim: true },
    linkedNcrTitle: { type: String, default: "", trim: true },
    checklistItems: { type: [ChecklistItemSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true, collection: "qc_handover_inspections" },
);

QcHandoverInspectionSchema.index({ siteId: 1, inspectionNo: 1 }, { unique: true });
QcHandoverInspectionSchema.index({ siteId: 1, inspectionType: 1, plannedInspectionDate: -1 });
QcHandoverInspectionSchema.index({ siteId: 1, status: 1, plannedInspectionDate: -1 });
QcHandoverInspectionSchema.index({ siteId: 1, approvalStatus: 1, plannedInspectionDate: -1 });
QcHandoverInspectionSchema.index({ siteId: 1, openFindingCount: -1, plannedInspectionDate: -1 });
QcHandoverInspectionSchema.index({ siteId: 1, linkedProcessInspectionId: 1 });
QcHandoverInspectionSchema.index({ siteId: 1, linkedNcrId: 1 });
QcHandoverInspectionSchema.plugin(baseFieldsPlugin);

const QcHandoverInspection: Model<IQcHandoverInspection> =
  mongoose.models.QcHandoverInspection ||
  mongoose.model<IQcHandoverInspection>("QcHandoverInspection", QcHandoverInspectionSchema);

export default QcHandoverInspection;

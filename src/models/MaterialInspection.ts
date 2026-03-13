import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QC_MATERIAL_CATEGORY_VALUES,
  QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES,
  QC_MATERIAL_INSPECTION_DISPOSITION_VALUES,
  QC_MATERIAL_INSPECTION_HISTORY_ACTION_VALUES,
  QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES,
  QC_MATERIAL_INSPECTION_RESULT_VALUES,
  type QcMaterialCategory,
  type QcMaterialInspectionCheckStatus,
  type QcMaterialInspectionDisposition,
  type QcMaterialInspectionHistoryAction,
  type QcMaterialInspectionNcrStatus,
  type QcMaterialInspectionResult,
} from "@/lib/qc-material-inspections";
import { QC_ATTACHMENT_CATEGORY_VALUES, type QcAttachmentCategory } from "@/lib/qc-core";

export interface IMaterialInspectionAttachment {
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
}

export interface IMaterialInspectionChecklistItem {
  itemId: string;
  label: string;
  status: QcMaterialInspectionCheckStatus;
  note: string;
}

export interface IMaterialInspectionHistoryEntry {
  actionType: QcMaterialInspectionHistoryAction;
  result: QcMaterialInspectionResult;
  disposition: QcMaterialInspectionDisposition;
  note: string;
  actorName: string;
  actionDate: Date;
}

export interface IMaterialInspection extends Document {
  siteId: mongoose.Types.ObjectId;
  materialCategory: QcMaterialCategory;
  materialName: string;
  specification?: string;
  supplier?: string;
  lotNo?: string;
  inboundDate?: Date;
  quantity: number;
  unit: string;
  inspectionDate: Date;
  result: QcMaterialInspectionResult;
  disposition: QcMaterialInspectionDisposition;
  inspector?: string;
  linkedItpPlanId?: mongoose.Types.ObjectId;
  linkedItpPlanTitle?: string;
  linkedItpCheckpointId?: string;
  linkedItpCheckpointTitle?: string;
  inspectionStandard?: string;
  checklistItems: IMaterialInspectionChecklistItem[];
  decisionReason?: string;
  remarks?: string;
  attachments: IMaterialInspectionAttachment[];
  fileAssetId?: mongoose.Types.ObjectId;
  ncrStatus: QcMaterialInspectionNcrStatus;
  ncrReference?: string;
  history: IMaterialInspectionHistoryEntry[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IMaterialInspection>;
}

const MaterialInspectionAttachmentSchema = new Schema<IMaterialInspectionAttachment>(
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

const MaterialInspectionChecklistItemSchema = new Schema<IMaterialInspectionChecklistItem>(
  {
    itemId: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES,
      default: "pending",
      required: true,
    },
    note: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const MaterialInspectionHistoryEntrySchema = new Schema<IMaterialInspectionHistoryEntry>(
  {
    actionType: {
      type: String,
      enum: QC_MATERIAL_INSPECTION_HISTORY_ACTION_VALUES,
      required: true,
    },
    result: {
      type: String,
      enum: QC_MATERIAL_INSPECTION_RESULT_VALUES,
      required: true,
    },
    disposition: {
      type: String,
      enum: QC_MATERIAL_INSPECTION_DISPOSITION_VALUES,
      default: "none",
      required: true,
    },
    note: { type: String, default: "", trim: true },
    actorName: { type: String, default: "", trim: true },
    actionDate: { type: Date, default: Date.now, required: true },
  },
  { _id: false },
);

const MaterialInspectionSchema = new Schema<IMaterialInspection>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    materialCategory: {
      type: String,
      enum: QC_MATERIAL_CATEGORY_VALUES,
      default: "other",
      required: true,
    },
    materialName: { type: String, required: true, trim: true },
    specification: { type: String, trim: true },
    supplier: { type: String, trim: true },
    lotNo: { type: String, trim: true },
    inboundDate: { type: Date },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    inspectionDate: { type: Date, required: true },
    result: {
      type: String,
      enum: QC_MATERIAL_INSPECTION_RESULT_VALUES,
      default: "pending",
    },
    disposition: {
      type: String,
      enum: QC_MATERIAL_INSPECTION_DISPOSITION_VALUES,
      default: "none",
      required: true,
    },
    inspector: { type: String, trim: true },
    linkedItpPlanId: { type: Schema.Types.ObjectId, ref: "QcInspectionTestPlan" },
    linkedItpPlanTitle: { type: String, trim: true },
    linkedItpCheckpointId: { type: String, trim: true },
    linkedItpCheckpointTitle: { type: String, trim: true },
    inspectionStandard: { type: String, trim: true },
    checklistItems: { type: [MaterialInspectionChecklistItemSchema], default: [] },
    decisionReason: { type: String, trim: true },
    remarks: { type: String },
    attachments: { type: [MaterialInspectionAttachmentSchema], default: [] },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
    ncrStatus: {
      type: String,
      enum: QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES,
      default: "none",
      required: true,
    },
    ncrReference: { type: String, trim: true },
    history: { type: [MaterialInspectionHistoryEntrySchema], default: [] },
  },
  { timestamps: true, collection: "material_inspections" },
);

MaterialInspectionSchema.index({ siteId: 1, inspectionDate: -1 });
MaterialInspectionSchema.index({ siteId: 1, result: 1, inspectionDate: -1 });
MaterialInspectionSchema.index({ siteId: 1, disposition: 1, inspectionDate: -1 });
MaterialInspectionSchema.index({ siteId: 1, materialCategory: 1, supplier: 1 });
MaterialInspectionSchema.index({ siteId: 1, materialName: 1, supplier: 1 });
MaterialInspectionSchema.index({ siteId: 1, linkedItpPlanId: 1, inspectionDate: -1 });
MaterialInspectionSchema.plugin(baseFieldsPlugin);

const MaterialInspection: Model<IMaterialInspection> =
  mongoose.models.MaterialInspection ||
  mongoose.model<IMaterialInspection>("MaterialInspection", MaterialInspectionSchema);

export default MaterialInspection;

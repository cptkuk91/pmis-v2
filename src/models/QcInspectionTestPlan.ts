import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QC_ITP_HOLD_POINT_VALUES,
  QC_ITP_ITEM_TYPE_VALUES,
  QC_ITP_STATUS_VALUES,
  type QcItpHoldPoint,
  type QcItpItemType,
  type QcItpStatus,
} from "@/lib/qc-itp";

export interface IQcInspectionTestPlanCheckpoint {
  checkpointId: string;
  phaseName: string;
  checkpointTitle: string;
  checkpointType: QcItpItemType;
  holdPoint: QcItpHoldPoint;
  timing: string;
  frequency: string;
  acceptanceCriteria: string;
  referenceCode: string;
  ownerName: string;
  ownerMemberId: string;
}

export interface IQcInspectionTestPlan extends Document {
  siteId: mongoose.Types.ObjectId;
  year: number;
  versionNo: number;
  status: QcItpStatus;
  planTitle: string;
  workType: string;
  processStep: string;
  scopeSummary: string;
  revisionReason: string;
  referenceDrawingNo: string;
  referenceSpec: string;
  notes: string;
  checkpoints: IQcInspectionTestPlanCheckpoint[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQcInspectionTestPlan>;
}

const QcInspectionTestPlanCheckpointSchema = new Schema<IQcInspectionTestPlanCheckpoint>(
  {
    checkpointId: { type: String, required: true, trim: true },
    phaseName: { type: String, required: true, trim: true },
    checkpointTitle: { type: String, required: true, trim: true },
    checkpointType: {
      type: String,
      enum: QC_ITP_ITEM_TYPE_VALUES,
      default: "inspection",
      required: true,
    },
    holdPoint: {
      type: String,
      enum: QC_ITP_HOLD_POINT_VALUES,
      default: "none",
      required: true,
    },
    timing: { type: String, default: "", trim: true },
    frequency: { type: String, default: "", trim: true },
    acceptanceCriteria: { type: String, required: true, trim: true },
    referenceCode: { type: String, default: "", trim: true },
    ownerName: { type: String, default: "", trim: true },
    ownerMemberId: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const QcInspectionTestPlanSchema = new Schema<IQcInspectionTestPlan>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    year: { type: Number, required: true, index: true },
    versionNo: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: QC_ITP_STATUS_VALUES,
      default: "draft",
      required: true,
      index: true,
    },
    planTitle: { type: String, required: true, trim: true },
    workType: { type: String, required: true, trim: true, index: true },
    processStep: { type: String, required: true, trim: true },
    scopeSummary: { type: String, required: true, trim: true },
    revisionReason: { type: String, default: "", trim: true },
    referenceDrawingNo: { type: String, default: "", trim: true },
    referenceSpec: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    checkpoints: { type: [QcInspectionTestPlanCheckpointSchema], default: [] },
  },
  { timestamps: true, collection: "qc_inspection_test_plans" },
);

QcInspectionTestPlanSchema.index({ siteId: 1, year: -1, versionNo: -1, createdAt: -1 });
QcInspectionTestPlanSchema.index({ siteId: 1, status: 1, year: -1 });
QcInspectionTestPlanSchema.index({ siteId: 1, workType: 1, updatedAt: -1 });
QcInspectionTestPlanSchema.plugin(baseFieldsPlugin);

const QcInspectionTestPlan: Model<IQcInspectionTestPlan> =
  mongoose.models.QcInspectionTestPlan ||
  mongoose.model<IQcInspectionTestPlan>("QcInspectionTestPlan", QcInspectionTestPlanSchema);

export default QcInspectionTestPlan;

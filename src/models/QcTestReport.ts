import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import { QC_ATTACHMENT_CATEGORY_VALUES, type QcAttachmentCategory } from "@/lib/qc-core";
import {
  QC_TEST_REPORT_HISTORY_ACTION_VALUES,
  QC_TEST_REPORT_JUDGEMENT_RULE_VALUES,
  QC_TEST_REPORT_NCR_STATUS_VALUES,
  QC_TEST_REPORT_RESULT_VALUES,
  QC_TEST_REPORT_SOURCE_TYPE_VALUES,
  QC_TEST_REPORT_STATUS_VALUES,
  QC_TEST_REPORT_TYPE_VALUES,
  type QcTestReportHistoryAction,
  type QcTestReportJudgementRule,
  type QcTestReportNcrStatus,
  type QcTestReportResult,
  type QcTestReportSourceType,
  type QcTestReportStatus,
  type QcTestReportType,
} from "@/lib/qc-test-reports";

export interface IQcTestReportAttachment {
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
}

export interface IQcTestReportHistoryEntry {
  actionType: QcTestReportHistoryAction;
  status: QcTestReportStatus;
  result: QcTestReportResult;
  versionNo: number;
  note: string;
  actorName: string;
  actionDate: Date;
}

export interface IQcTestReport extends Document {
  siteId: mongoose.Types.ObjectId;
  testType: QcTestReportType;
  sourceType: QcTestReportSourceType;
  sampleName: string;
  specimenNo: string;
  samplingLocation: string;
  samplingDate: Date;
  testDate: Date;
  linkedMaterialInspectionId?: mongoose.Types.ObjectId;
  linkedMaterialInspectionTitle?: string;
  linkedProcessInspectionId?: mongoose.Types.ObjectId;
  linkedProcessInspectionTitle?: string;
  standardValue: number;
  measuredValue: number;
  toleranceValue: number;
  unit: string;
  judgementRule: QcTestReportJudgementRule;
  result: QcTestReportResult;
  deviationValue: number;
  deviationRate: number;
  testingAgency: string;
  certificateNo: string;
  versionNo: number;
  status: QcTestReportStatus;
  reporterName: string;
  reviewerName: string;
  reviewerMemberId: string;
  approverName: string;
  approverMemberId: string;
  summary: string;
  attachments: IQcTestReportAttachment[];
  ncrStatus: QcTestReportNcrStatus;
  ncrReference: string;
  history: IQcTestReportHistoryEntry[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQcTestReport>;
}

const QcTestReportAttachmentSchema = new Schema<IQcTestReportAttachment>(
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

const QcTestReportHistoryEntrySchema = new Schema<IQcTestReportHistoryEntry>(
  {
    actionType: {
      type: String,
      enum: QC_TEST_REPORT_HISTORY_ACTION_VALUES,
      required: true,
    },
    status: {
      type: String,
      enum: QC_TEST_REPORT_STATUS_VALUES,
      required: true,
    },
    result: {
      type: String,
      enum: QC_TEST_REPORT_RESULT_VALUES,
      required: true,
    },
    versionNo: { type: Number, default: 1, required: true },
    note: { type: String, default: "", trim: true },
    actorName: { type: String, default: "", trim: true },
    actionDate: { type: Date, default: Date.now, required: true },
  },
  { _id: false },
);

const QcTestReportSchema = new Schema<IQcTestReport>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    testType: {
      type: String,
      enum: QC_TEST_REPORT_TYPE_VALUES,
      default: "other",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: QC_TEST_REPORT_SOURCE_TYPE_VALUES,
      default: "manual",
      required: true,
      index: true,
    },
    sampleName: { type: String, required: true, trim: true },
    specimenNo: { type: String, default: "", trim: true },
    samplingLocation: { type: String, default: "", trim: true },
    samplingDate: { type: Date, required: true, index: true },
    testDate: { type: Date, required: true, index: true },
    linkedMaterialInspectionId: { type: Schema.Types.ObjectId, ref: "MaterialInspection" },
    linkedMaterialInspectionTitle: { type: String, default: "", trim: true },
    linkedProcessInspectionId: { type: Schema.Types.ObjectId, ref: "QcProcessInspection" },
    linkedProcessInspectionTitle: { type: String, default: "", trim: true },
    standardValue: { type: Number, required: true, default: 0 },
    measuredValue: { type: Number, required: true, default: 0 },
    toleranceValue: { type: Number, required: true, default: 0 },
    unit: { type: String, default: "", trim: true },
    judgementRule: {
      type: String,
      enum: QC_TEST_REPORT_JUDGEMENT_RULE_VALUES,
      default: "minimum",
      required: true,
    },
    result: {
      type: String,
      enum: QC_TEST_REPORT_RESULT_VALUES,
      default: "pending",
      required: true,
      index: true,
    },
    deviationValue: { type: Number, required: true, default: 0 },
    deviationRate: { type: Number, required: true, default: 0 },
    testingAgency: { type: String, default: "", trim: true },
    certificateNo: { type: String, default: "", trim: true },
    versionNo: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: QC_TEST_REPORT_STATUS_VALUES,
      default: "draft",
      required: true,
      index: true,
    },
    reporterName: { type: String, default: "", trim: true },
    reviewerName: { type: String, default: "", trim: true },
    reviewerMemberId: { type: String, default: "", trim: true },
    approverName: { type: String, default: "", trim: true },
    approverMemberId: { type: String, default: "", trim: true },
    summary: { type: String, default: "", trim: true },
    attachments: { type: [QcTestReportAttachmentSchema], default: [] },
    ncrStatus: {
      type: String,
      enum: QC_TEST_REPORT_NCR_STATUS_VALUES,
      default: "none",
      required: true,
      index: true,
    },
    ncrReference: { type: String, default: "", trim: true },
    history: { type: [QcTestReportHistoryEntrySchema], default: [] },
  },
  { timestamps: true, collection: "qc_test_reports" },
);

QcTestReportSchema.index({ siteId: 1, testDate: -1 });
QcTestReportSchema.index({ siteId: 1, status: 1, testDate: -1 });
QcTestReportSchema.index({ siteId: 1, result: 1, testDate: -1 });
QcTestReportSchema.index({ siteId: 1, sourceType: 1, testDate: -1 });
QcTestReportSchema.index({ siteId: 1, linkedMaterialInspectionId: 1, testDate: -1 });
QcTestReportSchema.index({ siteId: 1, linkedProcessInspectionId: 1, testDate: -1 });
QcTestReportSchema.plugin(baseFieldsPlugin);

const QcTestReport: Model<IQcTestReport> =
  mongoose.models.QcTestReport || mongoose.model<IQcTestReport>("QcTestReport", QcTestReportSchema);

export default QcTestReport;

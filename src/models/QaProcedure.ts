import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QA_PROCEDURE_DOCUMENT_TYPE_VALUES,
  QA_PROCEDURE_REFERENCE_TARGET_VALUES,
  QA_PROCEDURE_SCOPE_TYPE_VALUES,
  QA_PROCEDURE_STATUS_VALUES,
  type QaProcedureDocumentType,
  type QaProcedureReferenceTarget,
  type QaProcedureScopeType,
  type QaProcedureStatus,
} from "@/lib/qa-procedures";

export interface IQaProcedure extends Document {
  siteId: mongoose.Types.ObjectId;
  documentKey: string;
  categoryCode: string;
  documentType: QaProcedureDocumentType;
  title: string;
  summary: string;
  scopeType: QaProcedureScopeType;
  scopeSummary: string;
  versionNo: number;
  effectiveDate?: Date | null;
  status: QaProcedureStatus;
  retiredAt?: Date | null;
  isSiteRequired: boolean;
  referenceTargets: QaProcedureReferenceTarget[];
  externalDocUrl: string;
  fileAssetId?: mongoose.Types.ObjectId | null;
  fileName: string;
  authorName: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQaProcedure>;
}

const QaProcedureSchema = new Schema<IQaProcedure>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    documentKey: { type: String, required: true, trim: true, index: true },
    categoryCode: { type: String, required: true, trim: true, index: true },
    documentType: {
      type: String,
      enum: QA_PROCEDURE_DOCUMENT_TYPE_VALUES,
      required: true,
      default: "procedure",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "", trim: true },
    scopeType: {
      type: String,
      enum: QA_PROCEDURE_SCOPE_TYPE_VALUES,
      required: true,
      default: "common",
    },
    scopeSummary: { type: String, required: true, trim: true },
    versionNo: { type: Number, required: true, default: 1 },
    effectiveDate: { type: Date, default: null },
    status: {
      type: String,
      enum: QA_PROCEDURE_STATUS_VALUES,
      required: true,
      default: "active",
      index: true,
    },
    retiredAt: { type: Date, default: null },
    isSiteRequired: { type: Boolean, default: true },
    referenceTargets: {
      type: [{ type: String, enum: QA_PROCEDURE_REFERENCE_TARGET_VALUES }],
      default: [],
    },
    externalDocUrl: { type: String, default: "", trim: true },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    fileName: { type: String, default: "", trim: true },
    authorName: { type: String, required: true, trim: true, default: "관리자" },
  },
  { timestamps: true, collection: "qa_procedures" },
);

QaProcedureSchema.index({ siteId: 1, documentKey: 1, versionNo: -1 });
QaProcedureSchema.index({ siteId: 1, categoryCode: 1, documentType: 1, createdAt: -1 });
QaProcedureSchema.plugin(baseFieldsPlugin);

const QaProcedure: Model<IQaProcedure> =
  mongoose.models.QaProcedure || mongoose.model<IQaProcedure>("QaProcedure", QaProcedureSchema);

export default QaProcedure;

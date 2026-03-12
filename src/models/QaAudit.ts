import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QA_AUDIT_RESULT_VALUES,
  QA_AUDIT_STATUS_VALUES,
  QA_AUDIT_TYPE_VALUES,
  type QaAuditResult,
  type QaAuditStatus,
  type QaAuditType,
} from "@/lib/qa-audits";

export interface IQaAuditProcedureRef {
  procedureId: string;
  documentKey: string;
  title: string;
  versionNo: number;
}

export interface IQaAuditChecklistItem {
  checklistId: string;
  sectionTitle: string;
  itemTitle: string;
  criteria: string;
  result: QaAuditResult;
  note: string;
  requiresCapa: boolean;
  linkedCapaId: string;
}

export interface IQaAudit extends Document {
  siteId: mongoose.Types.ObjectId;
  auditTitle: string;
  auditType: QaAuditType;
  status: QaAuditStatus;
  plannedDate: Date;
  actualDate?: Date | null;
  auditeeName: string;
  scopeSummary: string;
  auditLeadName: string;
  auditLeadMemberId: string;
  linkedAssurancePlanId: string;
  linkedAssurancePlanTitle: string;
  linkedAssurancePlanYear?: number | null;
  linkedAssurancePlanVersionNo?: number | null;
  referencedProcedures: IQaAuditProcedureRef[];
  checklistItems: IQaAuditChecklistItem[];
  resultSummary: string;
  nonconformityCount: number;
  observationCount: number;
  capaRequestedCount: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQaAudit>;
}

const QaAuditProcedureRefSchema = new Schema<IQaAuditProcedureRef>(
  {
    procedureId: { type: String, required: true, trim: true },
    documentKey: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    versionNo: { type: Number, default: 1 },
  },
  { _id: false },
);

const QaAuditChecklistItemSchema = new Schema<IQaAuditChecklistItem>(
  {
    checklistId: { type: String, required: true, trim: true },
    sectionTitle: { type: String, required: true, trim: true },
    itemTitle: { type: String, required: true, trim: true },
    criteria: { type: String, required: true, trim: true },
    result: {
      type: String,
      enum: QA_AUDIT_RESULT_VALUES,
      default: "conformity",
      required: true,
    },
    note: { type: String, default: "", trim: true },
    requiresCapa: { type: Boolean, default: false },
    linkedCapaId: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const QaAuditSchema = new Schema<IQaAudit>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    auditTitle: { type: String, required: true, trim: true },
    auditType: {
      type: String,
      enum: QA_AUDIT_TYPE_VALUES,
      required: true,
      default: "regular",
      index: true,
    },
    status: {
      type: String,
      enum: QA_AUDIT_STATUS_VALUES,
      required: true,
      default: "planned",
      index: true,
    },
    plannedDate: { type: Date, required: true, index: true },
    actualDate: { type: Date, default: null },
    auditeeName: { type: String, required: true, trim: true },
    scopeSummary: { type: String, required: true, trim: true },
    auditLeadName: { type: String, required: true, trim: true },
    auditLeadMemberId: { type: String, required: true, trim: true },
    linkedAssurancePlanId: { type: String, default: "", trim: true },
    linkedAssurancePlanTitle: { type: String, default: "", trim: true },
    linkedAssurancePlanYear: { type: Number, default: null },
    linkedAssurancePlanVersionNo: { type: Number, default: null },
    referencedProcedures: { type: [QaAuditProcedureRefSchema], default: [] },
    checklistItems: { type: [QaAuditChecklistItemSchema], default: [] },
    resultSummary: { type: String, default: "", trim: true },
    nonconformityCount: { type: Number, default: 0 },
    observationCount: { type: Number, default: 0 },
    capaRequestedCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "qa_audits" },
);

QaAuditSchema.index({ siteId: 1, plannedDate: -1, createdAt: -1 });
QaAuditSchema.index({ siteId: 1, status: 1, plannedDate: -1 });
QaAuditSchema.plugin(baseFieldsPlugin);

const QaAudit: Model<IQaAudit> = mongoose.models.QaAudit || mongoose.model<IQaAudit>("QaAudit", QaAuditSchema);

export default QaAudit;

import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QA_PARTNER_ASSURANCE_STATUS_VALUES,
  QA_PARTNER_CATEGORY_VALUES,
  QA_PARTNER_CRITERION_CATEGORY_VALUES,
  QA_PARTNER_EVALUATION_TYPE_VALUES,
  QA_PARTNER_FOLLOW_UP_STATUS_VALUES,
  QA_PARTNER_GRADE_VALUES,
  QA_PARTNER_RISK_LEVEL_VALUES,
  QA_PARTNER_SOURCE_VALUES,
  type QaPartnerAssuranceStatus,
  type QaPartnerCategory,
  type QaPartnerCriterionCategory,
  type QaPartnerEvaluationType,
  type QaPartnerFollowUpStatus,
  type QaPartnerGrade,
  type QaPartnerRiskLevel,
  type QaPartnerSource,
} from "@/lib/qa-partner-assurance";

export interface IQaPartnerAssessmentItem {
  itemId: string;
  criterionCategory: QaPartnerCriterionCategory;
  criterionTitle: string;
  maxScore: number;
  score: number;
  comment: string;
  requiresImprovement: boolean;
}

export interface IQaPartnerAssurance extends Document {
  siteId: mongoose.Types.ObjectId;
  partnerCode: string;
  partnerName: string;
  partnerSource: QaPartnerSource;
  partnerCategory: QaPartnerCategory;
  evaluationType: QaPartnerEvaluationType;
  status: QaPartnerAssuranceStatus;
  evaluationDate: Date;
  nextReviewDate?: Date | null;
  evaluatorName: string;
  evaluatorMemberId: string;
  contactName: string;
  contactPhone: string;
  scopeSummary: string;
  summary: string;
  improvementRequest: string;
  followUpStatus: QaPartnerFollowUpStatus;
  linkedCapaId: string;
  assessmentItems: IQaPartnerAssessmentItem[];
  totalScore: number;
  maxScore: number;
  grade: QaPartnerGrade;
  riskLevel: QaPartnerRiskLevel;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQaPartnerAssurance>;
}

const QaPartnerAssessmentItemSchema = new Schema<IQaPartnerAssessmentItem>(
  {
    itemId: { type: String, required: true, trim: true },
    criterionCategory: {
      type: String,
      enum: QA_PARTNER_CRITERION_CATEGORY_VALUES,
      required: true,
      default: "quality_system",
    },
    criterionTitle: { type: String, required: true, trim: true },
    maxScore: { type: Number, required: true, default: 25 },
    score: { type: Number, required: true, default: 0 },
    comment: { type: String, default: "", trim: true },
    requiresImprovement: { type: Boolean, default: false },
  },
  { _id: false },
);

const QaPartnerAssuranceSchema = new Schema<IQaPartnerAssurance>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    partnerCode: { type: String, default: "", trim: true },
    partnerName: { type: String, required: true, trim: true, index: true },
    partnerSource: {
      type: String,
      enum: QA_PARTNER_SOURCE_VALUES,
      required: true,
      default: "manual",
      index: true,
    },
    partnerCategory: {
      type: String,
      enum: QA_PARTNER_CATEGORY_VALUES,
      required: true,
      default: "subcontractor",
      index: true,
    },
    evaluationType: {
      type: String,
      enum: QA_PARTNER_EVALUATION_TYPE_VALUES,
      required: true,
      default: "regular",
      index: true,
    },
    status: {
      type: String,
      enum: QA_PARTNER_ASSURANCE_STATUS_VALUES,
      required: true,
      default: "draft",
      index: true,
    },
    evaluationDate: { type: Date, required: true, index: true },
    nextReviewDate: { type: Date, default: null },
    evaluatorName: { type: String, required: true, trim: true },
    evaluatorMemberId: { type: String, required: true, trim: true, index: true },
    contactName: { type: String, default: "", trim: true },
    contactPhone: { type: String, default: "", trim: true },
    scopeSummary: { type: String, required: true, trim: true },
    summary: { type: String, default: "", trim: true },
    improvementRequest: { type: String, default: "", trim: true },
    followUpStatus: {
      type: String,
      enum: QA_PARTNER_FOLLOW_UP_STATUS_VALUES,
      required: true,
      default: "not_required",
      index: true,
    },
    linkedCapaId: { type: String, default: "", trim: true },
    assessmentItems: { type: [QaPartnerAssessmentItemSchema], default: [] },
    totalScore: { type: Number, required: true, default: 0 },
    maxScore: { type: Number, required: true, default: 0 },
    grade: {
      type: String,
      enum: QA_PARTNER_GRADE_VALUES,
      required: true,
      default: "D",
      index: true,
    },
    riskLevel: {
      type: String,
      enum: QA_PARTNER_RISK_LEVEL_VALUES,
      required: true,
      default: "low",
      index: true,
    },
  },
  { timestamps: true, collection: "qa_partner_assurance" },
);

QaPartnerAssuranceSchema.index({ siteId: 1, evaluationDate: -1, createdAt: -1 });
QaPartnerAssuranceSchema.index({ siteId: 1, partnerName: 1, evaluationDate: -1 });
QaPartnerAssuranceSchema.index({ siteId: 1, followUpStatus: 1, riskLevel: 1 });
QaPartnerAssuranceSchema.plugin(baseFieldsPlugin);

const QaPartnerAssurance: Model<IQaPartnerAssurance> =
  mongoose.models.QaPartnerAssurance ||
  mongoose.model<IQaPartnerAssurance>("QaPartnerAssurance", QaPartnerAssuranceSchema);

export default QaPartnerAssurance;

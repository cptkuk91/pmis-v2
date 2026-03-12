import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QA_ASSURANCE_CHECKPOINT_STATUS_VALUES,
  QA_ASSURANCE_PLAN_STATUS_VALUES,
  type QaAssuranceCheckpointStatus,
  type QaAssurancePlanStatus,
} from "@/lib/qa-assurance-plans";

export interface IQaAssuranceCheckpoint {
  checkpointId: string;
  phaseName: string;
  checkpointTitle: string;
  inspectionMethod: string;
  acceptanceCriteria: string;
  referenceProcedure: string;
  ownerName: string;
  ownerMemberId: string;
  status: QaAssuranceCheckpointStatus;
}

export interface IQaAssurancePlan extends Document {
  siteId: mongoose.Types.ObjectId;
  year: number;
  versionNo: number;
  status: QaAssurancePlanStatus;
  planTitle: string;
  revisionReason: string;
  linkedPolicyGoalId: string;
  linkedPolicyGoalTitle: string;
  linkedPolicyGoalYear?: number | null;
  linkedPolicyGoalRevisionNo?: number | null;
  scopeSummary: string;
  qualityObjectiveSummary: string;
  templateReference: string;
  checkpoints: IQaAssuranceCheckpoint[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQaAssurancePlan>;
}

const QaAssuranceCheckpointSchema = new Schema<IQaAssuranceCheckpoint>(
  {
    checkpointId: { type: String, required: true, trim: true },
    phaseName: { type: String, required: true, trim: true },
    checkpointTitle: { type: String, required: true, trim: true },
    inspectionMethod: { type: String, default: "", trim: true },
    acceptanceCriteria: { type: String, required: true, trim: true },
    referenceProcedure: { type: String, default: "", trim: true },
    ownerName: { type: String, default: "", trim: true },
    ownerMemberId: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: QA_ASSURANCE_CHECKPOINT_STATUS_VALUES,
      default: "planned",
      required: true,
    },
  },
  { _id: false },
);

const QaAssurancePlanSchema = new Schema<IQaAssurancePlan>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    year: { type: Number, required: true, index: true },
    versionNo: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: QA_ASSURANCE_PLAN_STATUS_VALUES,
      default: "draft",
      required: true,
      index: true,
    },
    planTitle: { type: String, required: true, trim: true },
    revisionReason: { type: String, default: "", trim: true },
    linkedPolicyGoalId: { type: String, default: "", trim: true },
    linkedPolicyGoalTitle: { type: String, default: "", trim: true },
    linkedPolicyGoalYear: { type: Number, default: null },
    linkedPolicyGoalRevisionNo: { type: Number, default: null },
    scopeSummary: { type: String, required: true, trim: true },
    qualityObjectiveSummary: { type: String, required: true, trim: true },
    templateReference: { type: String, default: "", trim: true },
    checkpoints: { type: [QaAssuranceCheckpointSchema], default: [] },
  },
  { timestamps: true, collection: "qa_assurance_plans" },
);

QaAssurancePlanSchema.index({ siteId: 1, year: -1, versionNo: -1, createdAt: -1 });
QaAssurancePlanSchema.index({ siteId: 1, status: 1, year: -1 });
QaAssurancePlanSchema.plugin(baseFieldsPlugin);

const QaAssurancePlan: Model<IQaAssurancePlan> =
  mongoose.models.QaAssurancePlan ||
  mongoose.model<IQaAssurancePlan>("QaAssurancePlan", QaAssurancePlanSchema);

export default QaAssurancePlan;

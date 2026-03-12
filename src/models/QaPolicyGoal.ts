import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QA_MEASUREMENT_CYCLE_VALUES,
  QA_POLICY_GOAL_STATUS_VALUES,
  type QaMeasurementCycle,
  type QaPolicyGoalStatus,
} from "@/lib/qa-policy-goals";

export interface IQaPolicyGoalItem {
  goalId: string;
  title: string;
  metricName: string;
  unit: string;
  targetValue: string;
  measurementCycle: QaMeasurementCycle;
  ownerName: string;
  ownerMemberId: string;
  note: string;
}

export interface IQaPolicyGoal extends Document {
  siteId: mongoose.Types.ObjectId;
  year: number;
  status: QaPolicyGoalStatus;
  policyTitle: string;
  policyStatement: string;
  effectiveDate?: Date | null;
  revisionNo: number;
  goals: IQaPolicyGoalItem[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQaPolicyGoal>;
}

const QaPolicyGoalItemSchema = new Schema<IQaPolicyGoalItem>(
  {
    goalId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    metricName: { type: String, required: true, trim: true },
    unit: { type: String, default: "", trim: true },
    targetValue: { type: String, required: true, trim: true },
    measurementCycle: {
      type: String,
      enum: QA_MEASUREMENT_CYCLE_VALUES,
      default: "monthly",
      required: true,
    },
    ownerName: { type: String, default: "", trim: true },
    ownerMemberId: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const QaPolicyGoalSchema = new Schema<IQaPolicyGoal>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    year: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: QA_POLICY_GOAL_STATUS_VALUES,
      default: "draft",
      required: true,
      index: true,
    },
    policyTitle: { type: String, required: true, trim: true },
    policyStatement: { type: String, required: true, trim: true },
    effectiveDate: { type: Date, default: null },
    revisionNo: { type: Number, required: true, default: 1 },
    goals: { type: [QaPolicyGoalItemSchema], default: [] },
  },
  { timestamps: true, collection: "qa_policy_goals" },
);

QaPolicyGoalSchema.index({ siteId: 1, year: -1, revisionNo: -1, createdAt: -1 });
QaPolicyGoalSchema.index({ siteId: 1, status: 1, year: -1 });
QaPolicyGoalSchema.plugin(baseFieldsPlugin);

const QaPolicyGoal: Model<IQaPolicyGoal> =
  mongoose.models.QaPolicyGoal || mongoose.model<IQaPolicyGoal>("QaPolicyGoal", QaPolicyGoalSchema);

export default QaPolicyGoal;

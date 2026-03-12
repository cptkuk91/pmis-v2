import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  QA_KPI_CYCLE_VALUES,
  QA_KPI_SOURCE_METRIC_VALUES,
  QA_KPI_TARGET_DIRECTION_VALUES,
  type QaKpiCycle,
  type QaKpiSourceMetric,
  type QaKpiTargetDirection,
} from "@/lib/qa-kpi";

export interface IQaKpiDefinition extends Document {
  siteId: mongoose.Types.ObjectId;
  metricCode: string;
  metricName: string;
  sourceMetric: QaKpiSourceMetric;
  measurementCycle: QaKpiCycle;
  unit: string;
  targetDirection: QaKpiTargetDirection;
  targetValue: number;
  warningThreshold?: number | null;
  linkedPolicyGoalId: string;
  linkedPolicyGoalYear?: number | null;
  linkedPolicyGoalTitle: string;
  linkedPolicyGoalGoalId: string;
  linkedPolicyGoalMetricName: string;
  ownerName: string;
  ownerMemberId: string;
  description: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete: () => Promise<IQaKpiDefinition>;
}

const QaKpiDefinitionSchema = new Schema<IQaKpiDefinition>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    metricCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    metricName: { type: String, required: true, trim: true },
    sourceMetric: {
      type: String,
      enum: QA_KPI_SOURCE_METRIC_VALUES,
      required: true,
      default: "audit_nonconformity_count",
      index: true,
    },
    measurementCycle: {
      type: String,
      enum: QA_KPI_CYCLE_VALUES,
      required: true,
      default: "monthly",
      index: true,
    },
    unit: { type: String, required: true, trim: true, default: "건" },
    targetDirection: {
      type: String,
      enum: QA_KPI_TARGET_DIRECTION_VALUES,
      required: true,
      default: "at_most",
    },
    targetValue: { type: Number, required: true, default: 0 },
    warningThreshold: { type: Number, default: null },
    linkedPolicyGoalId: { type: String, default: "", trim: true },
    linkedPolicyGoalYear: { type: Number, default: null },
    linkedPolicyGoalTitle: { type: String, default: "", trim: true },
    linkedPolicyGoalGoalId: { type: String, default: "", trim: true },
    linkedPolicyGoalMetricName: { type: String, default: "", trim: true },
    ownerName: { type: String, default: "", trim: true },
    ownerMemberId: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "qa_kpi_definitions" },
);

QaKpiDefinitionSchema.index({ siteId: 1, metricCode: 1 });
QaKpiDefinitionSchema.index({ siteId: 1, isActive: 1, measurementCycle: 1 });
QaKpiDefinitionSchema.plugin(baseFieldsPlugin);

const QaKpiDefinition: Model<IQaKpiDefinition> =
  mongoose.models.QaKpiDefinition ||
  mongoose.model<IQaKpiDefinition>("QaKpiDefinition", QaKpiDefinitionSchema);

export default QaKpiDefinition;

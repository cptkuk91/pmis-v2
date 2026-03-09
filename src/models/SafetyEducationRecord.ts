import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  SAFETY_TRAINING_TYPES,
  type SafetyTrainingType,
} from "@/lib/safety-training-type";

export interface ISafetyEducationRecord extends Document {
  siteId: string;
  educationType: SafetyTrainingType;
  title: string;
  educationDate: Date;
  instructor: string;
  duration: number;
  attendeeCount: number;
  content: string;
  remarks: string;
}

const SafetyEducationRecordSchema = new Schema<ISafetyEducationRecord>(
  {
    siteId: { type: String, required: true, index: true },
    educationType: { type: String, enum: SAFETY_TRAINING_TYPES, required: true },
    title: { type: String, required: true },
    educationDate: { type: Date, required: true },
    instructor: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    attendeeCount: { type: Number, default: 0 },
    content: { type: String, default: "" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "safety_education_records" },
);

SafetyEducationRecordSchema.index({ siteId: 1, educationDate: -1 });
SafetyEducationRecordSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyEducationRecord || mongoose.model<ISafetyEducationRecord>("SafetyEducationRecord", SafetyEducationRecordSchema);

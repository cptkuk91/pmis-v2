import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyMileageRecord extends Document {
  siteId: string;
  managerName: string;
  category: string;
  points: number;
  recordDate: Date;
  description: string;
  remarks: string;
}

const SafetyMileageRecordSchema = new Schema<ISafetyMileageRecord>(
  {
    siteId: { type: String, required: true, index: true },
    managerName: { type: String, required: true },
    category: { type: String, required: true },
    points: { type: Number, default: 0 },
    recordDate: { type: Date, required: true },
    description: { type: String, default: "" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "safety_mileage_records" },
);

SafetyMileageRecordSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyMileageRecord || mongoose.model<ISafetyMileageRecord>("SafetyMileageRecord", SafetyMileageRecordSchema);

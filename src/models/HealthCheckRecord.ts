import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IHealthCheckRecord extends Document {
  siteId: string;
  workerUserId?: mongoose.Types.ObjectId;
  workerName: string;
  company: string;
  checkType: "regular" | "special" | "hiring";
  checkDate: Date;
  result: "normal" | "observation" | "abnormal";
  hospital: string;
  remarks: string;
}

const HealthCheckRecordSchema = new Schema<IHealthCheckRecord>(
  {
    siteId: { type: String, required: true, index: true },
    workerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    workerName: { type: String, required: true },
    company: { type: String, default: "" },
    checkType: { type: String, enum: ["regular", "special", "hiring"], required: true },
    checkDate: { type: Date, required: true },
    result: { type: String, enum: ["normal", "observation", "abnormal"], default: "normal" },
    hospital: { type: String, default: "" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "health_check_records" },
);

HealthCheckRecordSchema.plugin(baseFieldsPlugin);

export default mongoose.models.HealthCheckRecord || mongoose.model<IHealthCheckRecord>("HealthCheckRecord", HealthCheckRecordSchema);

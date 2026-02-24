import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyReport extends Document {
  siteId: string;
  reportType: "situation" | "cost";
  title: string;
  reportDate: Date;
  content: string;
  amount?: number;
  remarks: string;
}

const SafetyReportSchema = new Schema<ISafetyReport>(
  {
    siteId: { type: String, required: true, index: true },
    reportType: { type: String, enum: ["situation", "cost"], required: true },
    title: { type: String, required: true },
    reportDate: { type: Date, required: true },
    content: { type: String, default: "" },
    amount: { type: Number },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "safety_reports" },
);

SafetyReportSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyReport || mongoose.model<ISafetyReport>("SafetyReport", SafetyReportSchema);

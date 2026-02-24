import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IGovernmentReport extends Document {
  siteId: string;
  reportType: string;
  title: string;
  reportDate: Date;
  agency: string;
  status: "pending" | "submitted" | "completed";
  remarks: string;
}

const GovernmentReportSchema = new Schema<IGovernmentReport>(
  {
    siteId: { type: String, required: true, index: true },
    reportType: { type: String, required: true },
    title: { type: String, required: true },
    reportDate: { type: Date, required: true },
    agency: { type: String, default: "" },
    status: { type: String, enum: ["pending", "submitted", "completed"], default: "pending" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "government_reports" },
);

GovernmentReportSchema.plugin(baseFieldsPlugin);

export default mongoose.models.GovernmentReport || mongoose.model<IGovernmentReport>("GovernmentReport", GovernmentReportSchema);

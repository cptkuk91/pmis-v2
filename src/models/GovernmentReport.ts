import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  GOVERNMENT_REPORT_AGENCY_VALUES,
  GOVERNMENT_REPORT_TYPES,
  type GovernmentReportAgency,
  type GovernmentReportType,
} from "@/lib/government-report-constants";

export interface IGovernmentReport extends Document {
  siteId: string;
  reportType: GovernmentReportType;
  title: string;
  reportDate: Date;
  agency: GovernmentReportAgency | "";
  status: "pending" | "submitted" | "completed";
  remarks: string;
}

const GovernmentReportSchema = new Schema<IGovernmentReport>(
  {
    siteId: { type: String, required: true, index: true },
    reportType: { type: String, enum: GOVERNMENT_REPORT_TYPES, required: true },
    title: { type: String, required: true },
    reportDate: { type: Date, required: true },
    agency: { type: String, enum: GOVERNMENT_REPORT_AGENCY_VALUES, default: "" },
    status: { type: String, enum: ["pending", "submitted", "completed"], default: "pending" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "government_reports" },
);

GovernmentReportSchema.plugin(baseFieldsPlugin);

export default mongoose.models.GovernmentReport || mongoose.model<IGovernmentReport>("GovernmentReport", GovernmentReportSchema);

import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IWorkforceAttendance extends Document {
  siteId: mongoose.Types.ObjectId;
  attendanceDate: Date;
  workerName: string;
  company?: string;
  jobType?: string;
  workType?: string;
  isPresent: boolean;
  hoursWorked?: number;
  overtimeHours?: number;
  remarks?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IWorkforceAttendance>;
}

const WorkforceAttendanceSchema = new Schema<IWorkforceAttendance>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    attendanceDate: { type: Date, required: true },
    workerName: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    jobType: { type: String, trim: true },
    workType: { type: String, trim: true },
    isPresent: { type: Boolean, default: true },
    hoursWorked: { type: Number },
    overtimeHours: { type: Number },
    remarks: { type: String },
  },
  { timestamps: true },
);

WorkforceAttendanceSchema.index({ siteId: 1, attendanceDate: -1 });
WorkforceAttendanceSchema.plugin(baseFieldsPlugin);

const WorkforceAttendance: Model<IWorkforceAttendance> =
  mongoose.models.WorkforceAttendance ||
  mongoose.model<IWorkforceAttendance>("WorkforceAttendance", WorkforceAttendanceSchema);

export default WorkforceAttendance;

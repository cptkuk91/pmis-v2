import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import type { Status } from "@/types";

export type ReportType = "supervision" | "daily" | "weekly";

export interface IReportAttachment {
  fileAssetId: mongoose.Types.ObjectId;
  fileName: string;
  sortOrder: number;
}

export interface IReport extends Document {
  siteId: mongoose.Types.ObjectId;
  reportType: ReportType;
  title: string;
  reportDate: Date;
  authorName: string;
  content: string;
  progressRate: number;
  attachments: IReportAttachment[];
  status: Status;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IReport>;
}

const ReportSchema = new Schema<IReport>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    reportType: {
      type: String,
      enum: ["supervision", "daily", "weekly"],
      default: "weekly",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    reportDate: { type: Date, required: true, index: true },
    authorName: { type: String, required: true, trim: true, default: "현장관리자" },
    content: { type: String, default: "", trim: true },
    progressRate: { type: Number, default: 0, min: 0, max: 100 },
    attachments: [
      {
        _id: false,
        fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", required: true },
        fileName: { type: String, required: true, trim: true },
        sortOrder: { type: Number, default: 0 },
      },
    ],
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "rejected", "completed"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true },
);

ReportSchema.index({ siteId: 1, reportDate: -1, reportType: 1 });
ReportSchema.plugin(baseFieldsPlugin);

const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);

export default Report;

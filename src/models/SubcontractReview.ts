import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISubcontractReview extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  contractorName: string;
  workType?: string;
  contractAmount?: number;
  requestDate: Date;
  requestedBy?: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  approvedDate?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  remarks?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISubcontractReview>;
}

const SubcontractReviewSchema = new Schema<ISubcontractReview>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    title: { type: String, required: true, trim: true },
    contractorName: { type: String, required: true, trim: true },
    workType: { type: String, trim: true },
    contractAmount: { type: Number },
    requestDate: { type: Date, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedDate: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
    remarks: { type: String },
  },
  { timestamps: true },
);

SubcontractReviewSchema.index({ siteId: 1, approvedDate: -1 });
SubcontractReviewSchema.plugin(baseFieldsPlugin);

const SubcontractReview: Model<ISubcontractReview> =
  mongoose.models.SubcontractReview ||
  mongoose.model<ISubcontractReview>("SubcontractReview", SubcontractReviewSchema);

export default SubcontractReview;

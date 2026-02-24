import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISubcontractReviewItem extends Document {
  siteId: mongoose.Types.ObjectId;
  reviewId: mongoose.Types.ObjectId;
  itemNo: number;
  checkItem: string;
  result: "pass" | "fail" | "na";
  remarks?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISubcontractReviewItem>;
}

const SubcontractReviewItemSchema = new Schema<ISubcontractReviewItem>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    reviewId: { type: Schema.Types.ObjectId, ref: "SubcontractReview", required: true },
    itemNo: { type: Number, required: true },
    checkItem: { type: String, required: true, trim: true },
    result: {
      type: String,
      enum: ["pass", "fail", "na"],
      default: "na",
    },
    remarks: { type: String },
  },
  { timestamps: true },
);

SubcontractReviewItemSchema.index({ reviewId: 1, itemNo: 1 });
SubcontractReviewItemSchema.plugin(baseFieldsPlugin);

const SubcontractReviewItem: Model<ISubcontractReviewItem> =
  mongoose.models.SubcontractReviewItem ||
  mongoose.model<ISubcontractReviewItem>("SubcontractReviewItem", SubcontractReviewItemSchema);

export default SubcontractReviewItem;

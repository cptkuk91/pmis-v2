import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export type DrawingDecisionStatus = "pending" | "approved" | "rejected";

export interface IDrawingReview extends Document {
  siteId: mongoose.Types.ObjectId;
  docNo: string;
  drawingNo: string;
  drawingName: string;
  discipline: string;
  location: string;
  requesterName: string;
  reviewerName: string;
  requestedAt: Date;
  decisionStatus: DrawingDecisionStatus;
  decisionComment: string;
  decidedAt?: Date;
  requestContent: string;
  classificationCode: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDrawingReview>;
}

const DrawingReviewSchema = new Schema<IDrawingReview>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    docNo: { type: String, required: true, trim: true },
    drawingNo: { type: String, required: true, trim: true },
    drawingName: { type: String, required: true, trim: true },
    discipline: { type: String, default: "건축", trim: true },
    location: { type: String, default: "", trim: true },
    requesterName: { type: String, required: true, trim: true },
    reviewerName: { type: String, default: "", trim: true },
    requestedAt: { type: Date, default: () => new Date(), index: true },
    decisionStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    decisionComment: { type: String, default: "", trim: true },
    decidedAt: { type: Date, default: null },
    requestContent: { type: String, default: "", trim: true },
    classificationCode: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

DrawingReviewSchema.index({ siteId: 1, requestedAt: -1 });
DrawingReviewSchema.index({ siteId: 1, decisionStatus: 1, requestedAt: -1 });
DrawingReviewSchema.plugin(baseFieldsPlugin);

const DrawingReview: Model<IDrawingReview> =
  mongoose.models.DrawingReview ||
  mongoose.model<IDrawingReview>("DrawingReview", DrawingReviewSchema);

export default DrawingReview;

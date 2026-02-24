import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import type { Status } from "@/types";

export interface IDesignChange extends Document {
  siteId: mongoose.Types.ObjectId;
  changeNo: string;
  drawingNo: string;
  drawingName: string;
  location: string;
  reason: string;
  requestedByName: string;
  reviewedByName: string;
  status: Status;
  requestedAt: Date;
  reviewedAt?: Date;
  reviewComment: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDesignChange>;
}

const DesignChangeSchema = new Schema<IDesignChange>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    changeNo: { type: String, required: true, trim: true },
    drawingNo: { type: String, required: true, trim: true },
    drawingName: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    reason: { type: String, default: "", trim: true },
    requestedByName: { type: String, required: true, trim: true },
    reviewedByName: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "rejected", "completed"],
      default: "in_review",
      index: true,
    },
    requestedAt: { type: Date, default: () => new Date(), index: true },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

DesignChangeSchema.index({ siteId: 1, changeNo: 1 }, { unique: true });
DesignChangeSchema.index({ siteId: 1, requestedAt: -1 });
DesignChangeSchema.plugin(baseFieldsPlugin);

const DesignChange: Model<IDesignChange> =
  mongoose.models.DesignChange ||
  mongoose.model<IDesignChange>("DesignChange", DesignChangeSchema);

export default DesignChange;

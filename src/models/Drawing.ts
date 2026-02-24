import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import type { Status } from "@/types";

export interface IDrawing extends Document {
  siteId: mongoose.Types.ObjectId;
  drawingNo: string;
  drawingName: string;
  discipline: string;
  location: string;
  revision: string;
  status: Status;
  fileAssetId?: mongoose.Types.ObjectId;
  notes: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDrawing>;
}

const DrawingSchema = new Schema<IDrawing>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    drawingNo: { type: String, required: true, trim: true },
    drawingName: { type: String, required: true, trim: true },
    discipline: { type: String, default: "건축", trim: true },
    location: { type: String, default: "", trim: true },
    revision: { type: String, default: "0", trim: true },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "rejected", "completed"],
      default: "draft",
      index: true,
    },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

DrawingSchema.index({ siteId: 1, drawingNo: 1 }, { unique: true });
DrawingSchema.index({ siteId: 1, drawingNo: 1, revision: -1 });
DrawingSchema.index({ siteId: 1, drawingName: 1 });
DrawingSchema.plugin(baseFieldsPlugin);

const Drawing: Model<IDrawing> =
  mongoose.models.Drawing || mongoose.model<IDrawing>("Drawing", DrawingSchema);

export default Drawing;

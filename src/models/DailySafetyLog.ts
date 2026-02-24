import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import type { Status } from "@/types";

export interface IDailySafetyLog extends Document {
  siteId: mongoose.Types.ObjectId;
  logDate: Date;
  weather: string;
  workersCount: number;
  hazards: string;
  actions: string;
  notes: string;
  managerName: string;
  status: Status;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDailySafetyLog>;
}

const DailySafetyLogSchema = new Schema<IDailySafetyLog>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    logDate: { type: Date, required: true, index: true },
    weather: { type: String, default: "", trim: true },
    workersCount: { type: Number, default: 0, min: 0 },
    hazards: { type: String, default: "", trim: true },
    actions: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    managerName: { type: String, default: "현장소장", trim: true },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "rejected", "completed"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true },
);

DailySafetyLogSchema.index({ siteId: 1, logDate: -1 });
DailySafetyLogSchema.plugin(baseFieldsPlugin);

const DailySafetyLog: Model<IDailySafetyLog> =
  mongoose.models.DailySafetyLog ||
  mongoose.model<IDailySafetyLog>("DailySafetyLog", DailySafetyLogSchema);

export default DailySafetyLog;

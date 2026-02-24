import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IScheduleItem extends Document {
  siteId: mongoose.Types.ObjectId;
  taskCode: string;
  taskName: string;
  category: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  plannedProgress: number;
  actualProgress: number;
  parentTaskId?: mongoose.Types.ObjectId;
  sortOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IScheduleItem>;
}

const ScheduleItemSchema = new Schema<IScheduleItem>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    taskCode: { type: String, required: true, trim: true },
    taskName: { type: String, required: true, trim: true },
    category: { type: String, default: "공정", trim: true },
    plannedStart: { type: Date, required: true, index: true },
    plannedEnd: { type: Date, required: true, index: true },
    actualStart: { type: Date, default: null },
    actualEnd: { type: Date, default: null },
    plannedProgress: { type: Number, default: 0, min: 0, max: 100 },
    actualProgress: { type: Number, default: 0, min: 0, max: 100 },
    parentTaskId: { type: Schema.Types.ObjectId, ref: "ScheduleItem", default: null, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ScheduleItemSchema.index({ siteId: 1, taskCode: 1 }, { unique: true });
ScheduleItemSchema.index({ siteId: 1, plannedStart: 1, sortOrder: 1 });
ScheduleItemSchema.plugin(baseFieldsPlugin);

const ScheduleItem: Model<IScheduleItem> =
  mongoose.models.ScheduleItem ||
  mongoose.model<IScheduleItem>("ScheduleItem", ScheduleItemSchema);

export default ScheduleItem;

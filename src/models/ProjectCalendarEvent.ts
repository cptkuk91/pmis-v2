import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IProjectCalendarEvent extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  category: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  description: string;
  color: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IProjectCalendarEvent>;
}

const ProjectCalendarEventSchema = new Schema<IProjectCalendarEvent>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, default: "general", trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    isAllDay: { type: Boolean, default: true },
    description: { type: String, default: "", trim: true },
    color: { type: String, default: "#3b82f6", trim: true },
  },
  { timestamps: true },
);

ProjectCalendarEventSchema.index({ siteId: 1, startDate: 1, endDate: 1 });
ProjectCalendarEventSchema.plugin(baseFieldsPlugin);

const ProjectCalendarEvent: Model<IProjectCalendarEvent> =
  mongoose.models.ProjectCalendarEvent ||
  mongoose.model<IProjectCalendarEvent>("ProjectCalendarEvent", ProjectCalendarEventSchema);

export default ProjectCalendarEvent;

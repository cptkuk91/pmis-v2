import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IMeetingAttendee extends Document {
  meetingId: mongoose.Types.ObjectId;
  company: string;
  department: string;
  position: string;
  name: string;
  notifySent: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IMeetingAttendee>;
}

const MeetingAttendeeSchema = new Schema<IMeetingAttendee>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    company: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    notifySent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

MeetingAttendeeSchema.index({ meetingId: 1, name: 1 });
MeetingAttendeeSchema.plugin(baseFieldsPlugin);

const MeetingAttendee: Model<IMeetingAttendee> =
  mongoose.models.MeetingAttendee ||
  mongoose.model<IMeetingAttendee>("MeetingAttendee", MeetingAttendeeSchema);

export default MeetingAttendee;

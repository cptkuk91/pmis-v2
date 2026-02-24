import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IMeeting extends Document {
  siteId: mongoose.Types.ObjectId;
  category: string;
  agenda: string;
  meetingDate: Date;
  startTime: string;
  endTime: string;
  location: string;
  host: string;
  notice?: string;
  minutes?: string;
  minutesUpdatedAt?: Date;
  attachmentFileAssetId?: mongoose.Types.ObjectId;
  minutesFileAssetId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IMeeting>;
}

const MeetingSchema = new Schema<IMeeting>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    category: { type: String, required: true, trim: true },
    agenda: { type: String, required: true, trim: true },
    meetingDate: { type: Date, required: true, index: true },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "10:00" },
    location: { type: String, default: "회의실" },
    host: { type: String, default: "현장소장" },
    notice: { type: String, default: "" },
    minutes: { type: String, default: "" },
    minutesUpdatedAt: { type: Date, default: null },
    attachmentFileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    minutesFileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
  },
  { timestamps: true },
);

MeetingSchema.index({ siteId: 1, meetingDate: -1 });
MeetingSchema.plugin(baseFieldsPlugin);

const Meeting: Model<IMeeting> =
  mongoose.models.Meeting || mongoose.model<IMeeting>("Meeting", MeetingSchema);

export default Meeting;

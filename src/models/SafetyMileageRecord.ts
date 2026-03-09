import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  DEFAULT_SAFETY_MILEAGE_CATEGORY,
  SAFETY_MILEAGE_CATEGORIES,
} from "@/lib/safety-mileage-category";

export interface ISafetyMileageRecord extends Document {
  siteId: string;
  userId?: mongoose.Types.ObjectId;
  sitePersonnelId?: mongoose.Types.ObjectId;
  recipientName?: string;
  recipientEmail?: string;
  recipientCompany?: string;
  recipientPosition?: string;
  membershipRole?: "site_admin" | "manager" | "viewer";
  systemRole?: "super_admin" | "site_admin" | "manager" | "viewer";
  managerName?: string;
  category: string;
  points: number;
  recordDate: Date;
  description: string;
  remarks: string;
}

const SafetyMileageRecordSchema = new Schema<ISafetyMileageRecord>(
  {
    siteId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    sitePersonnelId: { type: Schema.Types.ObjectId, ref: "SitePersonnel" },
    recipientName: { type: String, trim: true },
    recipientEmail: { type: String, trim: true, default: "" },
    recipientCompany: { type: String, trim: true, default: "" },
    recipientPosition: { type: String, trim: true, default: "" },
    membershipRole: { type: String, enum: ["site_admin", "manager", "viewer"] },
    systemRole: { type: String, enum: ["super_admin", "site_admin", "manager", "viewer"] },
    managerName: { type: String, trim: true },
    category: {
      type: String,
      enum: [...SAFETY_MILEAGE_CATEGORIES],
      default: DEFAULT_SAFETY_MILEAGE_CATEGORY,
      required: true,
    },
    points: { type: Number, default: 1 },
    recordDate: { type: Date, required: true },
    description: { type: String, default: "" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "safety_mileage_records" },
);

SafetyMileageRecordSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyMileageRecord || mongoose.model<ISafetyMileageRecord>("SafetyMileageRecord", SafetyMileageRecordSchema);

import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISiteMembership extends Document {
  siteId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: "site_admin" | "manager" | "viewer";
  assignedAt: Date;
  revokedAt?: Date;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISiteMembership>;
}

const SiteMembershipSchema = new Schema<ISiteMembership>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["site_admin", "manager", "viewer"],
      default: "viewer",
    },
    assignedAt: { type: Date, default: () => new Date() },
    revokedAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

SiteMembershipSchema.index({ siteId: 1, userId: 1 }, { unique: true });
SiteMembershipSchema.plugin(baseFieldsPlugin);

const SiteMembership: Model<ISiteMembership> =
  mongoose.models.SiteMembership ||
  mongoose.model<ISiteMembership>("SiteMembership", SiteMembershipSchema);

export default SiteMembership;

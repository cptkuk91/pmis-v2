import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISite extends Document {
  siteCode: string;
  siteName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: "active" | "completed" | "suspended";
  startDate?: Date;
  endDate?: Date;
  description?: string;
  projectManager?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISite>;
}

const SiteSchema = new Schema<ISite>(
  {
    siteCode: { type: String, required: true, unique: true, trim: true },
    siteName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    status: {
      type: String,
      enum: ["active", "completed", "suspended"],
      default: "active",
    },
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String },
    projectManager: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

SiteSchema.plugin(baseFieldsPlugin);

const Site: Model<ISite> =
  mongoose.models.Site || mongoose.model<ISite>("Site", SiteSchema);

export default Site;

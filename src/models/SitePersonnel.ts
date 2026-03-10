import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISitePersonnel extends Document {
  siteId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  category: "constructor" | "partner" | "government";
  name: string;
  company?: string;
  position?: string;
  role?: string;
  phone?: string;
  email?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISitePersonnel>;
}

const SitePersonnelSchema = new Schema<ISitePersonnel>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    category: {
      type: String,
      enum: ["constructor", "partner", "government"],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    position: { type: String, trim: true },
    role: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

SitePersonnelSchema.index({ siteId: 1, category: 1 });
SitePersonnelSchema.plugin(baseFieldsPlugin);

const SitePersonnel: Model<ISitePersonnel> =
  mongoose.models.SitePersonnel ||
  mongoose.model<ISitePersonnel>("SitePersonnel", SitePersonnelSchema);

export default SitePersonnel;

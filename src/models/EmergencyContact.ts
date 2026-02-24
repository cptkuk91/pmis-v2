import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IEmergencyContact extends Document {
  siteId: mongoose.Types.ObjectId;
  category: string;
  organization: string;
  contactName?: string;
  phone: string;
  description?: string;
  sortOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IEmergencyContact>;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    category: { type: String, required: true, trim: true },
    organization: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    description: { type: String },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

EmergencyContactSchema.index({ siteId: 1, category: 1 });
EmergencyContactSchema.plugin(baseFieldsPlugin);

const EmergencyContact: Model<IEmergencyContact> =
  mongoose.models.EmergencyContact ||
  mongoose.model<IEmergencyContact>("EmergencyContact", EmergencyContactSchema);

export default EmergencyContact;

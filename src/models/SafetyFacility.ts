import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyFacility extends Document {
  siteId: string;
  facilityType: "standard" | "excellent";
  name: string;
  location: string;
  installDate: Date;
  inspectionDate?: Date;
  condition: "good" | "fair" | "poor";
  description: string;
  fileAssetId?: mongoose.Types.ObjectId;
  remarks: string;
}

const SafetyFacilitySchema = new Schema<ISafetyFacility>(
  {
    siteId: { type: String, required: true, index: true },
    facilityType: { type: String, enum: ["standard", "excellent"], required: true },
    name: { type: String, required: true },
    location: { type: String, default: "" },
    installDate: { type: Date, required: true },
    inspectionDate: { type: Date },
    condition: { type: String, enum: ["good", "fair", "poor"], default: "good" },
    description: { type: String, default: "" },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "safety_facilities" },
);

SafetyFacilitySchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyFacility || mongoose.model<ISafetyFacility>("SafetyFacility", SafetyFacilitySchema);

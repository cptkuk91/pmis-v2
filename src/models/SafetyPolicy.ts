import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyPolicy extends Document {
  siteId: string;
  policyType: "headquarters" | "site";
  title: string;
  content: string;
  effectiveDate?: Date;
  version: number;
}

const SafetyPolicySchema = new Schema<ISafetyPolicy>(
  {
    siteId: { type: String, required: true, index: true },
    policyType: { type: String, enum: ["headquarters", "site"], required: true },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    effectiveDate: { type: Date },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, collection: "safety_policies" },
);

SafetyPolicySchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyPolicy || mongoose.model<ISafetyPolicy>("SafetyPolicy", SafetyPolicySchema);

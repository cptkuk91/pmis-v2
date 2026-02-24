import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyRegulationItem extends Document {
  siteId: string;
  category: string;
  title: string;
  content: string;
  reference: string;
  sortOrder: number;
  isActive: boolean;
}

const SafetyRegulationItemSchema = new Schema<ISafetyRegulationItem>(
  {
    siteId: { type: String, required: true, index: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    reference: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "safety_regulation_items" },
);

SafetyRegulationItemSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyRegulationItem || mongoose.model<ISafetyRegulationItem>("SafetyRegulationItem", SafetyRegulationItemSchema);

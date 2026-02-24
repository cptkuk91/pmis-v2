import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyChecklist extends Document {
  siteId: string;
  title: string;
  checkDate: Date;
  inspector: string;
  category: string;
  items: { checkItem: string; result: "pass" | "fail" | "na"; remarks: string }[];
  overallResult: "pass" | "fail";
  remarks: string;
}

const SafetyChecklistSchema = new Schema<ISafetyChecklist>(
  {
    siteId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    checkDate: { type: Date, required: true },
    inspector: { type: String, required: true },
    category: { type: String, default: "" },
    items: [
      {
        checkItem: { type: String, required: true },
        result: { type: String, enum: ["pass", "fail", "na"], default: "na" },
        remarks: { type: String, default: "" },
      },
    ],
    overallResult: { type: String, enum: ["pass", "fail"], default: "pass" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "safety_checklists" },
);

SafetyChecklistSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyChecklist || mongoose.model<ISafetyChecklist>("SafetyChecklist", SafetyChecklistSchema);

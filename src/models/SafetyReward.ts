import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyReward extends Document {
  siteId: string;
  rewardType: "accident_free" | "mileage" | "checklist";
  title: string;
  targetDays: number;
  achievedDays: number;
  startDate: Date;
  endDate?: Date;
  status: "in_progress" | "achieved" | "failed";
  remarks: string;
}

const SafetyRewardSchema = new Schema<ISafetyReward>(
  {
    siteId: { type: String, required: true, index: true },
    rewardType: { type: String, enum: ["accident_free", "mileage", "checklist"], required: true },
    title: { type: String, required: true },
    targetDays: { type: Number, default: 0 },
    achievedDays: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: { type: String, enum: ["in_progress", "achieved", "failed"], default: "in_progress" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "safety_rewards" },
);

SafetyRewardSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyReward || mongoose.model<ISafetyReward>("SafetyReward", SafetyRewardSchema);

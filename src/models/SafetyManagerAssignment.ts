import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISafetyManagerAssignment extends Document {
  siteId: string;
  managerName: string;
  position: string;
  certificationNo: string;
  assignedDate: Date;
  expiryDate?: Date;
  role: string;
  isActive: boolean;
}

const SafetyManagerAssignmentSchema = new Schema<ISafetyManagerAssignment>(
  {
    siteId: { type: String, required: true, index: true },
    managerName: { type: String, required: true },
    position: { type: String, default: "" },
    certificationNo: { type: String, default: "" },
    assignedDate: { type: Date, required: true },
    expiryDate: { type: Date },
    role: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "safety_manager_assignments" },
);

SafetyManagerAssignmentSchema.plugin(baseFieldsPlugin);

export default mongoose.models.SafetyManagerAssignment || mongoose.model<ISafetyManagerAssignment>("SafetyManagerAssignment", SafetyManagerAssignmentSchema);

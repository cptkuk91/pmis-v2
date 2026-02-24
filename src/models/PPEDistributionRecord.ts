import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IPPEDistributionRecord extends Document {
  siteId: string;
  itemName: string;
  specification: string;
  quantity: number;
  unit: string;
  recipientName: string;
  recipientCompany: string;
  distributionDate: Date;
  remarks: string;
}

const PPEDistributionRecordSchema = new Schema<IPPEDistributionRecord>(
  {
    siteId: { type: String, required: true, index: true },
    itemName: { type: String, required: true },
    specification: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: "EA" },
    recipientName: { type: String, required: true },
    recipientCompany: { type: String, default: "" },
    distributionDate: { type: Date, required: true },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "ppe_distribution_records" },
);

PPEDistributionRecordSchema.plugin(baseFieldsPlugin);

export default mongoose.models.PPEDistributionRecord || mongoose.model<IPPEDistributionRecord>("PPEDistributionRecord", PPEDistributionRecordSchema);

import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  PPE_ITEM_OPTIONS,
  PPE_UNIT_OPTIONS,
  type PPEItemName,
  type PPEUnit,
} from "@/lib/ppe-options";

export interface IPPEDistributionRecord extends Document {
  siteId: string;
  itemName: PPEItemName;
  specification: string;
  quantity: number;
  unit: PPEUnit;
  recipientName: string;
  recipientCompany: string;
  distributionDate: Date;
  remarks: string;
}

const PPEDistributionRecordSchema = new Schema<IPPEDistributionRecord>(
  {
    siteId: { type: String, required: true, index: true },
    itemName: { type: String, enum: PPE_ITEM_OPTIONS, required: true },
    specification: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unit: { type: String, enum: PPE_UNIT_OPTIONS, default: "EA" },
    recipientName: { type: String, required: true },
    recipientCompany: { type: String, default: "" },
    distributionDate: { type: Date, required: true },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "ppe_distribution_records" },
);

PPEDistributionRecordSchema.plugin(baseFieldsPlugin);

export default mongoose.models.PPEDistributionRecord || mongoose.model<IPPEDistributionRecord>("PPEDistributionRecord", PPEDistributionRecordSchema);

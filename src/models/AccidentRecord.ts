import mongoose, { Schema, Document } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import { ACCIDENT_TYPES, type AccidentType } from "@/lib/accident-type";

export interface IAccidentRecord extends Document {
  siteId: string;
  accidentDate: Date;
  accidentType: AccidentType;
  location: string;
  description: string;
  injuredName: string;
  injuredCompany: string;
  severity: "minor" | "moderate" | "serious" | "fatal";
  actionTaken: string;
  preventiveMeasure: string;
  status: "reported" | "investigating" | "closed";
  remarks: string;
}

const AccidentRecordSchema = new Schema<IAccidentRecord>(
  {
    siteId: { type: String, required: true, index: true },
    accidentDate: { type: Date, required: true },
    accidentType: { type: String, enum: ACCIDENT_TYPES, required: true },
    location: { type: String, default: "" },
    description: { type: String, default: "" },
    injuredName: { type: String, default: "" },
    injuredCompany: { type: String, default: "" },
    severity: { type: String, enum: ["minor", "moderate", "serious", "fatal"], default: "minor" },
    actionTaken: { type: String, default: "" },
    preventiveMeasure: { type: String, default: "" },
    status: { type: String, enum: ["reported", "investigating", "closed"], default: "reported" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "accident_records" },
);

AccidentRecordSchema.plugin(baseFieldsPlugin);

export default mongoose.models.AccidentRecord || mongoose.model<IAccidentRecord>("AccidentRecord", AccidentRecordSchema);

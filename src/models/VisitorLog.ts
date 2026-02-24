import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IVisitorLog extends Document {
  siteId: mongoose.Types.ObjectId;
  visitorName: string;
  company?: string;
  purpose: string;
  visitDate: Date;
  checkInTime?: string;
  checkOutTime?: string;
  contactPerson?: string;
  phone?: string;
  vehicleNo?: string;
  remarks?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IVisitorLog>;
}

const VisitorLogSchema = new Schema<IVisitorLog>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    visitorName: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    purpose: { type: String, required: true, trim: true },
    visitDate: { type: Date, required: true },
    checkInTime: { type: String, trim: true },
    checkOutTime: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    vehicleNo: { type: String, trim: true },
    remarks: { type: String },
  },
  { timestamps: true },
);

VisitorLogSchema.index({ siteId: 1, visitDate: -1 });
VisitorLogSchema.plugin(baseFieldsPlugin);

const VisitorLog: Model<IVisitorLog> =
  mongoose.models.VisitorLog ||
  mongoose.model<IVisitorLog>("VisitorLog", VisitorLogSchema);

export default VisitorLog;

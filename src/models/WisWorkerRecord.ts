import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IWisWorkerRecord extends Document {
  siteId: mongoose.Types.ObjectId;
  workerName: string;
  company: string;
  occupation: string;
  recordDate: Date;
  recordType: "attendance" | "safety_education";
  checkInTime?: string;
  checkOutTime?: string;
  hoursWorked?: number;
  educationType?: string;
  educationTitle?: string;
  educationHours?: number;
  isSynced: boolean;
  syncedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IWisWorkerRecord>;
}

const WisWorkerRecordSchema = new Schema<IWisWorkerRecord>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    workerName: { type: String, required: true, trim: true },
    company: { type: String, default: "", trim: true },
    occupation: { type: String, default: "", trim: true },
    recordDate: { type: Date, required: true, index: true },
    recordType: {
      type: String,
      enum: ["attendance", "safety_education"],
      required: true,
      index: true,
    },
    checkInTime: { type: String, default: null, trim: true },
    checkOutTime: { type: String, default: null, trim: true },
    hoursWorked: { type: Number, default: null },
    educationType: { type: String, default: null, trim: true },
    educationTitle: { type: String, default: null, trim: true },
    educationHours: { type: Number, default: null },
    isSynced: { type: Boolean, default: false, index: true },
    syncedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "wis_worker_records" },
);

WisWorkerRecordSchema.index({ siteId: 1, recordDate: -1 });
WisWorkerRecordSchema.index({ siteId: 1, recordType: 1, recordDate: -1 });
WisWorkerRecordSchema.index({ isSynced: 1, recordDate: -1 });
WisWorkerRecordSchema.plugin(baseFieldsPlugin);

const WisWorkerRecord: Model<IWisWorkerRecord> =
  mongoose.models.WisWorkerRecord ||
  mongoose.model<IWisWorkerRecord>("WisWorkerRecord", WisWorkerRecordSchema);

export default WisWorkerRecord;

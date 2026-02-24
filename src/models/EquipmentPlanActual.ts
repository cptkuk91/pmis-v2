import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IEquipmentPlanActual extends Document {
  siteId: mongoose.Types.ObjectId;
  equipmentName: string;
  specification?: string;
  unit: string;
  planQty: number;
  actualQty: number;
  planDate?: Date;
  actualDate?: Date;
  rentalCompany?: string;
  unitPrice?: number;
  remarks?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IEquipmentPlanActual>;
}

const EquipmentPlanActualSchema = new Schema<IEquipmentPlanActual>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    equipmentName: { type: String, required: true, trim: true },
    specification: { type: String, trim: true },
    unit: { type: String, required: true, trim: true },
    planQty: { type: Number, default: 0 },
    actualQty: { type: Number, default: 0 },
    planDate: { type: Date },
    actualDate: { type: Date },
    rentalCompany: { type: String, trim: true },
    unitPrice: { type: Number },
    remarks: { type: String },
  },
  { timestamps: true },
);

EquipmentPlanActualSchema.index({ siteId: 1, planDate: -1 });
EquipmentPlanActualSchema.plugin(baseFieldsPlugin);

const EquipmentPlanActual: Model<IEquipmentPlanActual> =
  mongoose.models.EquipmentPlanActual ||
  mongoose.model<IEquipmentPlanActual>("EquipmentPlanActual", EquipmentPlanActualSchema);

export default EquipmentPlanActual;

import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  DEFAULT_MATERIAL_UNIT,
  MATERIAL_UNIT_OPTIONS,
  type MaterialUnit,
} from "@/lib/material-unit";

export interface IMaterialPlanActual extends Document {
  siteId: mongoose.Types.ObjectId;
  materialName: string;
  specification?: string;
  unit: MaterialUnit;
  planQty: number;
  actualQty: number;
  planDate?: Date;
  actualDate?: Date;
  supplier?: string;
  unitPrice?: number;
  remarks?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IMaterialPlanActual>;
}

const MaterialPlanActualSchema = new Schema<IMaterialPlanActual>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    materialName: { type: String, required: true, trim: true },
    specification: { type: String, trim: true },
    unit: { type: String, enum: MATERIAL_UNIT_OPTIONS, default: DEFAULT_MATERIAL_UNIT },
    planQty: { type: Number, default: 0 },
    actualQty: { type: Number, default: 0 },
    planDate: { type: Date },
    actualDate: { type: Date },
    supplier: { type: String, trim: true },
    unitPrice: { type: Number },
    remarks: { type: String },
  },
  { timestamps: true },
);

MaterialPlanActualSchema.index({ siteId: 1, planDate: -1 });
MaterialPlanActualSchema.plugin(baseFieldsPlugin);

const MaterialPlanActual: Model<IMaterialPlanActual> =
  mongoose.models.MaterialPlanActual ||
  mongoose.model<IMaterialPlanActual>("MaterialPlanActual", MaterialPlanActualSchema);

export default MaterialPlanActual;

import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";
import {
  DEFAULT_SUPPLIER_APPROVAL_TYPE,
  SUPPLIER_APPROVAL_TYPE_OPTIONS,
  type SupplierApprovalType,
} from "@/lib/supplier-approval";

export interface ISupplierApprovalRequest extends Document {
  siteId: mongoose.Types.ObjectId;
  approvalType: SupplierApprovalType;
  supplierName: string;
  materialName: string;
  specification?: string;
  manufacturer?: string;
  requestDate: Date;
  requestedBy?: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  fileAssetId?: mongoose.Types.ObjectId;
  remarks?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISupplierApprovalRequest>;
}

const SupplierApprovalRequestSchema = new Schema<ISupplierApprovalRequest>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    approvalType: {
      type: String,
      enum: SUPPLIER_APPROVAL_TYPE_OPTIONS,
      default: DEFAULT_SUPPLIER_APPROVAL_TYPE,
    },
    supplierName: { type: String, required: true, trim: true },
    materialName: { type: String, required: true, trim: true },
    specification: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    requestDate: { type: Date, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
    remarks: { type: String },
  },
  { timestamps: true },
);

SupplierApprovalRequestSchema.index({ siteId: 1, requestDate: -1 });
SupplierApprovalRequestSchema.plugin(baseFieldsPlugin);

const SupplierApprovalRequest: Model<ISupplierApprovalRequest> =
  mongoose.models.SupplierApprovalRequest ||
  mongoose.model<ISupplierApprovalRequest>("SupplierApprovalRequest", SupplierApprovalRequestSchema);

export default SupplierApprovalRequest;

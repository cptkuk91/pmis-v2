import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IAuditLog extends Document {
  siteId?: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;
  actorName?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IAuditLog>;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", default: null, index: true },
    action: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "", trim: true },
    details: { type: String, default: "", trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "audit_logs" },
);

AuditLogSchema.index({ siteId: 1, createdAt: -1 });
AuditLogSchema.plugin(baseFieldsPlugin);

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;

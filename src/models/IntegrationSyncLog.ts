import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IIntegrationSyncLog extends Document {
  siteId?: mongoose.Types.ObjectId;
  sourceSystem: "drawing_viewer" | "open_meteo" | "other";
  syncType: "full" | "incremental" | "retry";
  status: "pending" | "running" | "success" | "failed";
  startedAt: Date;
  completedAt?: Date;
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage?: string;
  errorDetails?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  triggeredBy?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IIntegrationSyncLog>;
}

const IntegrationSyncLogSchema = new Schema<IIntegrationSyncLog>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", default: null, index: true },
    sourceSystem: {
      type: String,
      enum: ["drawing_viewer", "open_meteo", "other"],
      required: true,
      index: true,
    },
    syncType: {
      type: String,
      enum: ["full", "incremental", "retry"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "success", "failed"],
      default: "pending",
      index: true,
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    recordsProcessed: { type: Number, default: 0 },
    recordsFailed: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
    errorDetails: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    nextRetryAt: { type: Date, default: null },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "integration_sync_logs" },
);

IntegrationSyncLogSchema.index({ sourceSystem: 1, status: 1 });
IntegrationSyncLogSchema.index({ siteId: 1, sourceSystem: 1, startedAt: -1 });
IntegrationSyncLogSchema.plugin(baseFieldsPlugin);

const IntegrationSyncLog: Model<IIntegrationSyncLog> =
  mongoose.models.IntegrationSyncLog ||
  mongoose.model<IIntegrationSyncLog>("IntegrationSyncLog", IntegrationSyncLogSchema);

export default IntegrationSyncLog;

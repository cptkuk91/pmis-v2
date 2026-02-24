import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISupportTicket extends Document {
  siteId?: mongoose.Types.ObjectId;
  ticketNo: string;
  category: "bug" | "feature" | "inquiry" | "complaint";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  title: string;
  content: string;
  reporterName: string;
  reporterEmail: string;
  assigneeName?: string;
  resolution?: string;
  resolvedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISupportTicket>;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", default: null, index: true },
    ticketNo: { type: String, required: true, unique: true, index: true, trim: true },
    category: {
      type: String,
      enum: ["bug", "feature", "inquiry", "complaint"],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    reporterName: { type: String, default: "", trim: true },
    reporterEmail: { type: String, default: "", trim: true },
    assigneeName: { type: String, default: null, trim: true },
    resolution: { type: String, default: null, trim: true },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "support_tickets" },
);

SupportTicketSchema.index({ siteId: 1, status: 1 });
SupportTicketSchema.index({ category: 1, priority: 1 });
SupportTicketSchema.plugin(baseFieldsPlugin);

const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);

export default SupportTicket;

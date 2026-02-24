import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IIssue extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  authorName: string;
  viewCount: number;
  status: "open" | "closed";
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IIssue>;
}

const IssueSchema = new Schema<IIssue>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true, default: "관리자" },
    viewCount: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
  },
  { timestamps: true },
);

IssueSchema.index({ siteId: 1, createdAt: -1 });
IssueSchema.plugin(baseFieldsPlugin);

const Issue: Model<IIssue> =
  mongoose.models.Issue || mongoose.model<IIssue>("Issue", IssueSchema);

export default Issue;

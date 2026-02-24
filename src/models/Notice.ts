import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface INotice extends Document {
  siteId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  authorName: string;
  isPinned: boolean;
  postedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<INotice>;
}

const NoticeSchema = new Schema<INotice>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true, default: "관리자" },
    isPinned: { type: Boolean, default: false },
    postedAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

NoticeSchema.index({ siteId: 1, postedAt: -1 });
NoticeSchema.plugin(baseFieldsPlugin);

const Notice: Model<INotice> =
  mongoose.models.Notice || mongoose.model<INotice>("Notice", NoticeSchema);

export default Notice;

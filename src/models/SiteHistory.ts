import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ISiteHistory extends Document {
  siteId: mongoose.Types.ObjectId;
  eventDate: Date;
  title: string;
  description?: string;
  category?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ISiteHistory>;
}

const SiteHistorySchema = new Schema<ISiteHistory>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    eventDate: { type: Date, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    category: { type: String, trim: true },
  },
  { timestamps: true },
);

SiteHistorySchema.index({ siteId: 1, eventDate: -1 });
SiteHistorySchema.plugin(baseFieldsPlugin);

const SiteHistory: Model<ISiteHistory> =
  mongoose.models.SiteHistory ||
  mongoose.model<ISiteHistory>("SiteHistory", SiteHistorySchema);

export default SiteHistory;

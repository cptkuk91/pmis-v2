import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface ICodeGroup extends Document {
  siteId: mongoose.Types.ObjectId;
  groupCode: string;
  groupName: string;
  sortOrder: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<ICodeGroup>;
}

const CodeGroupSchema = new Schema<ICodeGroup>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    groupCode: { type: String, required: true, trim: true, uppercase: true },
    groupName: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CodeGroupSchema.index({ siteId: 1, groupCode: 1 }, { unique: true });
CodeGroupSchema.plugin(baseFieldsPlugin);

const CodeGroup: Model<ICodeGroup> =
  mongoose.models.CodeGroup ||
  mongoose.model<ICodeGroup>("CodeGroup", CodeGroupSchema);

export default CodeGroup;

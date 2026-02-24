import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IFormTemplate extends Document {
  siteId: mongoose.Types.ObjectId;
  templateCode: string;
  templateName: string;
  description: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IFormTemplate>;
}

const FormTemplateSchema = new Schema<IFormTemplate>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    templateCode: { type: String, required: true, trim: true, uppercase: true },
    templateName: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    body: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

FormTemplateSchema.index({ siteId: 1, templateCode: 1 }, { unique: true });
FormTemplateSchema.index({ siteId: 1, sortOrder: 1 });
FormTemplateSchema.plugin(baseFieldsPlugin);

const FormTemplate: Model<IFormTemplate> =
  mongoose.models.FormTemplate ||
  mongoose.model<IFormTemplate>("FormTemplate", FormTemplateSchema);

export default FormTemplate;

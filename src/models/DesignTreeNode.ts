import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IDesignTreeNode extends Document {
  siteId: mongoose.Types.ObjectId;
  parentNodeId?: mongoose.Types.ObjectId;
  nodeCode: string;
  nodeName: string;
  sortOrder: number;
  depth: number;
  path: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IDesignTreeNode>;
}

const DesignTreeNodeSchema = new Schema<IDesignTreeNode>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    parentNodeId: { type: Schema.Types.ObjectId, ref: "DesignTreeNode", default: null, index: true },
    nodeCode: { type: String, required: true, trim: true },
    nodeName: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    depth: { type: Number, default: 0, index: true },
    path: { type: String, required: true, trim: true, index: true },
  },
  { timestamps: true },
);

DesignTreeNodeSchema.index({ siteId: 1, nodeCode: 1 }, { unique: true });
DesignTreeNodeSchema.index({ siteId: 1, parentNodeId: 1, sortOrder: 1 });
DesignTreeNodeSchema.plugin(baseFieldsPlugin);

const DesignTreeNode: Model<IDesignTreeNode> =
  mongoose.models.DesignTreeNode ||
  mongoose.model<IDesignTreeNode>("DesignTreeNode", DesignTreeNodeSchema);

export default DesignTreeNode;

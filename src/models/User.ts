import mongoose, { Schema, Document, Model } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  provider?: string;
  providerId?: string;
  role: "super_admin" | "site_admin" | "manager" | "viewer";
  isActive: boolean;
  lastLoginAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IUser>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String },
    provider: { type: String },
    providerId: { type: String },
    role: {
      type: String,
      enum: ["super_admin", "site_admin", "manager", "viewer"],
      default: "viewer",
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

UserSchema.plugin(baseFieldsPlugin);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;

import mongoose, { Document, Model, Schema } from "mongoose";
import { baseFieldsPlugin } from "@/lib/mongoose-plugins";

export interface IWeatherSnapshot extends Document {
  siteId: mongoose.Types.ObjectId;
  observedDate: Date;
  condition: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationChance: number;
  windSpeed: number;
  warning: string;
  source: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  softDelete: () => Promise<IWeatherSnapshot>;
}

const WeatherSnapshotSchema = new Schema<IWeatherSnapshot>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    observedDate: { type: Date, required: true, index: true },
    condition: { type: String, default: "맑음", trim: true },
    temperatureMin: { type: Number, default: 0 },
    temperatureMax: { type: Number, default: 0 },
    precipitationChance: { type: Number, default: 0, min: 0, max: 100 },
    windSpeed: { type: Number, default: 0, min: 0 },
    warning: { type: String, default: "", trim: true },
    source: { type: String, default: "mock", trim: true },
  },
  { timestamps: true },
);

WeatherSnapshotSchema.index({ siteId: 1, observedDate: -1 });
WeatherSnapshotSchema.plugin(baseFieldsPlugin);

const WeatherSnapshot: Model<IWeatherSnapshot> =
  mongoose.models.WeatherSnapshot ||
  mongoose.model<IWeatherSnapshot>("WeatherSnapshot", WeatherSnapshotSchema);

export default WeatherSnapshot;

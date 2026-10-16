import mongoose, { Schema, type Model } from "mongoose";

export interface TrainerProfileDoc extends mongoose.Document {
  user: mongoose.Types.ObjectId | null;
  branch: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  specialties: string[];
  qualifications: string[];
  bio: string;
  photo?: string;
  sessionRateMinor: number;
  compensationType: "fixed" | "per_session" | "revenue_share";
  compensationValueMinor: number;
  availability: { day: string; from: string; to: string }[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TrainerProfileSchema = new Schema<TrainerProfileDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true },
    specialties: { type: [String], default: [] },
    qualifications: { type: [String], default: [] },
    bio: { type: String, default: "" },
    photo: { type: String, default: "" },
    sessionRateMinor: { type: Number, default: 0, min: 0 },
    compensationType: { type: String, enum: ["fixed", "per_session", "revenue_share"], default: "per_session" },
    compensationValueMinor: { type: Number, default: 0, min: 0 },
    availability: {
      type: [{ day: String, from: String, to: String }],
      default: [],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const TrainerProfile: Model<TrainerProfileDoc> =
  mongoose.models.TrainerProfile ?? mongoose.model<TrainerProfileDoc>("TrainerProfile", TrainerProfileSchema);

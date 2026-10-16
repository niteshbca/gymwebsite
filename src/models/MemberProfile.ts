import mongoose, { Schema, type Model } from "mongoose";

export interface MemberProfileDoc extends mongoose.Document {
  memberNumber: string;
  user: mongoose.Types.ObjectId | null;
  branch: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  photo?: string;
  phone: string;
  email?: string;
  address?: string;
  dateOfBirth?: Date | null;
  gender?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  joinDate: Date;
  source: string; // website, walk_in, referral, phone, campaign
  notes?: string;
  healthInfo?: string;
  goals?: string;
  consentMarketing: boolean;
  consentHealthData: boolean;
  assignedTrainer?: mongoose.Types.ObjectId | null;
  status: "active" | "inactive" | "blocked";
  customFields?: Record<string, unknown>;
  profileHistory?: { at: Date; by: string; changes: Record<string, { from: unknown; to: unknown }> }[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MemberProfileSchema = new Schema<MemberProfileDoc>(
  {
    memberNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: "", trim: true },
    photo: { type: String, default: "" },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    address: { type: String, default: "" },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, default: "" },
    emergencyContactName: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },
    joinDate: { type: Date, required: true, default: Date.now },
    source: { type: String, default: "walk_in" },
    notes: { type: String, default: "" },
    healthInfo: { type: String, default: "" },
    goals: { type: String, default: "" },
    consentMarketing: { type: Boolean, default: false },
    consentHealthData: { type: Boolean, default: false },
    assignedTrainer: { type: Schema.Types.ObjectId, ref: "TrainerProfile", default: null },
    status: { type: String, enum: ["active", "inactive", "blocked"], default: "active", index: true },
    customFields: { type: Schema.Types.Mixed, default: {} },
    profileHistory: { type: [{ at: Date, by: String, changes: Schema.Types.Mixed }], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

MemberProfileSchema.index({ firstName: "text", lastName: "text", phone: "text", email: "text" });
MemberProfileSchema.index({ branch: 1, status: 1, createdAt: -1 });

export const MemberProfile: Model<MemberProfileDoc> =
  mongoose.models.MemberProfile ?? mongoose.model<MemberProfileDoc>("MemberProfile", MemberProfileSchema);

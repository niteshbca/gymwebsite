import mongoose, { Schema, type Model } from "mongoose";
import { ROLES, ALL_ROLES } from "@/lib/rbac";

export interface UserDoc extends mongoose.Document {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: string;
  branch: mongoose.Types.ObjectId | null;
  status: "active" | "disabled" | "pending";
  permissions: string[];
  memberProfile?: mongoose.Types.ObjectId | null;
  trainerProfile?: mongoose.Types.ObjectId | null;
  emailVerifiedAt?: Date | null;
  verifyTokenHash?: string | null;
  verifyTokenExp?: Date | null;
  resetTokenHash?: string | null;
  resetTokenExp?: Date | null;
  refreshTokenHash?: string | null;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  notificationPrefs: { emailExpiryReminders: boolean; emailReceipts: boolean; emailClassUpdates: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, required: true, enum: ALL_ROLES, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    status: { type: String, enum: ["active", "disabled", "pending"], default: "active", index: true },
    permissions: { type: [String], default: [] },
    memberProfile: { type: Schema.Types.ObjectId, ref: "MemberProfile", default: null },
    trainerProfile: { type: Schema.Types.ObjectId, ref: "TrainerProfile", default: null },
    emailVerifiedAt: { type: Date, default: null },
    verifyTokenHash: { type: String, default: null, select: false },
    verifyTokenExp: { type: Date, default: null },
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExp: { type: Date, default: null },
    refreshTokenHash: { type: String, default: null, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    notificationPrefs: {
      emailExpiryReminders: { type: Boolean, default: true },
      emailReceipts: { type: Boolean, default: true },
      emailClassUpdates: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

UserSchema.index({ role: 1, branch: 1 });
UserSchema.index({ name: "text", email: "text" });

export const User: Model<UserDoc> = mongoose.models.User ?? mongoose.model<UserDoc>("User", UserSchema);
export { ROLES };

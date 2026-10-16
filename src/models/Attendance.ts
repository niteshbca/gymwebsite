import mongoose, { Schema, type Model } from "mongoose";

export interface AttendanceDoc extends mongoose.Document {
  member: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  checkInAt: Date;
  checkOutAt: Date | null;
  method: "qr" | "member_id" | "manual" | "reception";
  verifiedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<AttendanceDoc>(
  {
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    checkInAt: { type: Date, required: true, default: Date.now, index: true },
    checkOutAt: { type: Date, default: null },
    method: { type: String, enum: ["qr", "member_id", "manual", "reception"], default: "reception" },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

AttendanceSchema.index({ member: 1, checkInAt: -1 });
AttendanceSchema.index({ branch: 1, checkInAt: -1 });

export const Attendance: Model<AttendanceDoc> =
  mongoose.models.Attendance ?? mongoose.model<AttendanceDoc>("Attendance", AttendanceSchema);

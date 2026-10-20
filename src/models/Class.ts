import mongoose, { Schema, type Model } from "mongoose";

export interface ClassDoc extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  intensity: string;
  branch: mongoose.Types.ObjectId;
  trainer: mongoose.Types.ObjectId | null;
  room: string;
  capacity: number;
  waitlistCapacity: number;
  dayOfWeek: number; // 0=Sun
  startTime: string; // "18:00"
  endTime: string;
  startDate: Date;
  endDate: Date | null;
  bookingWindowHours: number;
  cancelCutoffHours: number;
  requiresPlanAccess: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<ClassDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    intensity: { type: String, default: "All levels" },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    trainer: { type: Schema.Types.ObjectId, ref: "TrainerProfile", default: null },
    room: { type: String, default: "Main Floor" },
    capacity: { type: Number, required: true, min: 1 },
    waitlistCapacity: { type: Number, default: 5 },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    bookingWindowHours: { type: Number, default: 48 },
    cancelCutoffHours: { type: Number, default: 2 },
    requiresPlanAccess: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ClassSchema.index({ branch: 1, dayOfWeek: 1, startTime: 1 });

export const ClassModel: Model<ClassDoc> = mongoose.models.Class ?? mongoose.model<ClassDoc>("Class", ClassSchema);

export interface ClassBookingDoc extends mongoose.Document {
  class: mongoose.Types.ObjectId;
  occurrenceDate: Date; // date of the specific session (start of day)
  member: mongoose.Types.ObjectId | null;
  status: "pending" | "booked" | "waitlisted" | "cancelled" | "rejected" | "attended" | "no_show";
  /** "member" = booked from portal, "website" = public booking request needing approval */
  source: "member" | "website" | "reception";
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  notes: string;
  passCode: string;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
  rejectReason: string;
  bookedAt: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClassBookingSchema = new Schema<ClassBookingDoc>(
  {
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    occurrenceDate: { type: Date, required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", default: null, index: true },
    status: {
      type: String,
      enum: ["pending", "booked", "waitlisted", "cancelled", "rejected", "attended", "no_show"],
      default: "pending",
      index: true,
    },
    source: { type: String, enum: ["member", "website", "reception"], default: "website" },
    guestName: { type: String, default: "" },
    guestEmail: { type: String, default: "", lowercase: true, trim: true },
    guestPhone: { type: String, default: "" },
    notes: { type: String, default: "" },
    passCode: { type: String, default: "", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectReason: { type: String, default: "" },
    bookedAt: { type: Date, default: Date.now },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One active seat per member per session (guest bookings are checked in app code by email).
ClassBookingSchema.index(
  { class: 1, occurrenceDate: 1, member: 1 },
  { unique: true, partialFilterExpression: { member: { $type: "objectId" } } },
);

export const ClassBooking: Model<ClassBookingDoc> =
  mongoose.models.ClassBooking ?? mongoose.model<ClassBookingDoc>("ClassBooking", ClassBookingSchema);

export interface TrainingSessionDoc extends mongoose.Document {
  trainer: mongoose.Types.ObjectId;
  member: mongoose.Types.ObjectId;
  subscription: mongoose.Types.ObjectId | null;
  scheduledAt: Date;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingSessionSchema = new Schema<TrainingSessionDoc>(
  {
    trainer: { type: Schema.Types.ObjectId, ref: "TrainerProfile", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 60 },
    status: { type: String, enum: ["scheduled", "completed", "cancelled", "no_show"], default: "scheduled" },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const TrainingSession: Model<TrainingSessionDoc> =
  mongoose.models.TrainingSession ?? mongoose.model<TrainingSessionDoc>("TrainingSession", TrainingSessionSchema);

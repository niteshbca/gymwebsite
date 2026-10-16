import mongoose, { Schema, type Model } from "mongoose";

const AuditLogSchema = new Schema(
  {
    actor: { type: String, default: null, index: true },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AuditLogSchema.index({ entity: 1, createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog ?? mongoose.model("AuditLog", AuditLogSchema);

const EmailLogSchema = new Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    template: { type: String, default: "generic" },
    status: { type: String, enum: ["queued", "sent", "failed", "skipped_no_smtp"], required: true, index: true },
    messageId: { type: String, default: null },
    error: { type: String, default: null },
    entityId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const EmailLog = mongoose.models.EmailLog ?? mongoose.model("EmailLog", EmailLogSchema);

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    type: { type: String, default: "info" },
    link: { type: String, default: "" },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification ?? mongoose.model("Notification", NotificationSchema);

/** Dedupe key for reminder emails: `${subscriptionId}:${windowDays}:${yyyy-mm-dd}` */
const ReminderLogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true },
    windowDays: { type: Number, required: true },
    emailStatus: { type: String, enum: ["sent", "failed", "skipped_no_smtp", "skipped_optout"], required: true },
    emailError: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ReminderLog = mongoose.models.ReminderLog ?? mongoose.model("ReminderLog", ReminderLogSchema);

const CounterSchema = new Schema({ name: { type: String, required: true, unique: true }, seq: { type: Number, default: 0 } });
export const Counter = mongoose.models.Counter ?? mongoose.model("Counter", CounterSchema);

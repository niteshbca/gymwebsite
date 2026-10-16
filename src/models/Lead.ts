import mongoose, { Schema, type Model } from "mongoose";

export interface LeadDoc extends mongoose.Document {
  name: string;
  phone: string;
  email: string;
  interestedPlan: mongoose.Types.ObjectId | null;
  source: "website" | "call" | "walk_in" | "referral" | "social" | "campaign";
  branch: mongoose.Types.ObjectId | null;
  assignedTo: mongoose.Types.ObjectId | null;
  status: "new" | "contacted" | "trial" | "negotiation" | "converted" | "lost";
  followUpDate: Date | null;
  notes: string;
  lostReason: string;
  convertedMember: mongoose.Types.ObjectId | null;
  convertedAt: Date | null;
  history: { at: Date; by: string; from: string; to: string; note: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<LeadDoc>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, default: "", lowercase: true },
    interestedPlan: { type: Schema.Types.ObjectId, ref: "MembershipPlan", default: null },
    source: { type: String, enum: ["website", "call", "walk_in", "referral", "social", "campaign"], default: "website" },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["new", "contacted", "trial", "negotiation", "converted", "lost"], default: "new", index: true },
    followUpDate: { type: Date, default: null, index: true },
    notes: { type: String, default: "" },
    lostReason: { type: String, default: "" },
    convertedMember: { type: Schema.Types.ObjectId, ref: "MemberProfile", default: null },
    convertedAt: { type: Date, default: null },
    history: { type: [{ at: Date, by: String, from: String, to: String, note: String }], default: [] },
  },
  { timestamps: true },
);

export const Lead: Model<LeadDoc> = mongoose.models.Lead ?? mongoose.model<LeadDoc>("Lead", LeadSchema);

export interface ExpenseDoc extends mongoose.Document {
  branch: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId | null;
  title: string;
  amountMinor: number;
  date: Date;
  paymentMethod: string;
  billNumber: string;
  attachmentUrl: string;
  notes: string;
  status: "pending" | "approved" | "rejected" | "paid";
  createdBy: mongoose.Types.ObjectId | null;
  approvedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    title: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true, index: true },
    paymentMethod: { type: String, default: "cash" },
    billNumber: { type: String, default: "" },
    attachmentUrl: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "paid"], default: "paid", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const Expense: Model<ExpenseDoc> = mongoose.models.Expense ?? mongoose.model<ExpenseDoc>("Expense", ExpenseSchema);

export interface ExpenseCategoryDoc extends mongoose.Document {
  name: string;
  branch: mongoose.Types.ObjectId | null;
  active: boolean;
}
const ExpenseCategorySchema = new Schema<ExpenseCategoryDoc>(
  { name: { type: String, required: true }, branch: { type: Schema.Types.ObjectId, ref: "Branch", default: null }, active: { type: Boolean, default: true } },
  { timestamps: true },
);
export const ExpenseCategory: Model<ExpenseCategoryDoc> =
  mongoose.models.ExpenseCategory ?? mongoose.model<ExpenseCategoryDoc>("ExpenseCategory", ExpenseCategorySchema);

export interface VendorDoc extends mongoose.Document {
  name: string;
  contact: string;
  email: string;
  address: string;
  active: boolean;
}
const VendorSchema = new Schema<VendorDoc>(
  { name: { type: String, required: true }, contact: { type: String, default: "" }, email: { type: String, default: "" }, address: { type: String, default: "" }, active: { type: Boolean, default: true } },
  { timestamps: true },
);
export const Vendor: Model<VendorDoc> = mongoose.models.Vendor ?? mongoose.model<VendorDoc>("Vendor", VendorSchema);

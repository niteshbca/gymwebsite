import mongoose, { Schema, type Model } from "mongoose";

export interface BranchDoc extends mongoose.Document {
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  timezone: string;
  openingHours: { day: string; open: string; close: string; closed: boolean }[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<BranchDoc>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    timezone: { type: String, default: "Asia/Kolkata" },
    openingHours: {
      type: [{ day: String, open: String, close: String, closed: Boolean }],
      default: () =>
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
          day, open: "06:00", close: "22:00", closed: day === "Sun",
        })),
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Branch: Model<BranchDoc> = mongoose.models.Branch ?? mongoose.model<BranchDoc>("Branch", BranchSchema);

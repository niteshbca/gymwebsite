import mongoose, { Schema, type Model } from "mongoose";

export interface GymSettingsDoc extends mongoose.Document {
  gymName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  social: { facebook: string; instagram: string; youtube: string; twitter: string };
  currency: string;
  timezone: string;
  taxLabel: string;
  taxPercentDefault: number;
  invoicePrefix: string;
  invoiceNext: number;
  receiptFooter: string;
  membershipPolicy: string;
  cancellationPolicy: string;
  refundPolicy: string;
  privacyPolicy: string;
  terms: string;
  openingHours: { day: string; open: string; close: string; closed: boolean }[];
  facilities: { title: string; description: string; icon: string }[];
  trainersPublic: { name: string; specialty: string; photo: string; bio: string }[];
  testimonials: { name: string; quote: string; rating: number }[];
  faqs: { question: string; answer: string }[];
  hero: { title: string; subtitle: string; ctaText: string; imageUrl: string };
  gallery: { url: string; caption: string }[];
  mapLink: string;
  expiryReminderWindowsDays: number[];
  allowPartialPayments: boolean;
  allowSelfRegistration: boolean;
  themePrimary: string;
  createdAt: Date;
  updatedAt: Date;
}

const GymSettingsSchema = new Schema<GymSettingsDoc>(
  {
    gymName: { type: String, default: "NiteshPro" },
    tagline: { type: String, default: "Strength. Style. Discipline." },
    logoUrl: { type: String, default: "" },
    faviconUrl: { type: String, default: "" },
    address: { type: String, default: "12 Fitness Avenue, Andheri West" },
    city: { type: String, default: "Mumbai" },
    phone: { type: String, default: "+91 98765 43210" },
    email: { type: String, default: "hello@niteshpro.in" },
    website: { type: String, default: "https://niteshpro.in" },
    social: {
      type: { facebook: String, instagram: String, youtube: String, twitter: String },
      default: () => ({ facebook: "", instagram: "", youtube: "", twitter: "" }),
    },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
    taxLabel: { type: String, default: "GST" },
    taxPercentDefault: { type: Number, default: 18 },
    invoicePrefix: { type: String, default: "INV-" },
    invoiceNext: { type: Number, default: 1001 },
    receiptFooter: { type: String, default: "Thank you for training with NiteshPro." },
    membershipPolicy: { type: String, default: "Memberships are non-transferable. Please carry your member ID or QR at every visit." },
    cancellationPolicy: { type: String, default: "Cancellations must be requested in writing. Refunds are pro-rated as per plan cancellation terms." },
    refundPolicy: { type: String, default: "Refunds are processed within 7-10 business days to the original payment method." },
    privacyPolicy: { type: String, default: "We store only the data required to deliver gym services. Health information is collected with explicit consent." },
    terms: { type: String, default: "By using our services you agree to follow gym rules and safety guidelines." },
    openingHours: {
      type: [{ day: String, open: String, close: String, closed: Boolean }],
      default: () =>
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, open: "06:00", close: "22:00", closed: day === "Sun" })),
    },
    facilities: {
      type: [{ title: String, description: String, icon: String }],
      default: () => [
        { title: "Strength Floor", description: "Olympic racks, free weights and plate-loaded machines.", icon: "dumbbell" },
        { title: "Cardio Zone", description: "Treadmills, cycles and rowers with entertainment screens.", icon: "heart" },
        { title: "Group Studio", description: "Yoga, Zumba, HIIT and functional classes daily.", icon: "users" },
        { title: "Recovery", description: "Sauna, steam and stretching area.", icon: "sparkles" },
      ],
    },
    trainersPublic: { type: [{ name: String, specialty: String, photo: String, bio: String }], default: [] },
    testimonials: {
      type: [{ name: String, quote: String, rating: Number }],
      default: () => [
        { name: "Ananya S.", quote: "Lost 12kg in 6 months. The trainers actually care.", rating: 5 },
        { name: "Rahul M.", quote: "Best equipment and crowd. Renewed yearly.", rating: 5 },
      ],
    },
    faqs: {
      type: [{ question: String, answer: String }],
      default: () => [
        { question: "Do you offer a trial class?", answer: "Yes — submit the enquiry form and our team will schedule a free trial." },
        { question: "Can I freeze my membership?", answer: "Most plans allow up to 2 freezes. Contact the front desk before your expiry date." },
        { question: "What payment methods do you accept?", answer: "Cash, UPI, card and bank transfer. Online gateway payments can be enabled by the gym." },
      ],
    },
    hero: {
      type: { title: String, subtitle: String, ctaText: String, imageUrl: String },
      default: () => ({
        title: "Unleash Your Strongest Self",
        subtitle: "Elite coaches, boutique equipment and members-only experiences — NiteshPro is where ambition meets discipline.",
        ctaText: "Claim Your Free Trial",
        imageUrl: "",
      }),
    },
    gallery: { type: [{ url: String, caption: String }], default: [] },
    mapLink: { type: String, default: "https://maps.google.com" },
    expiryReminderWindowsDays: { type: [Number], default: [7, 3, 1] },
    allowPartialPayments: { type: Boolean, default: true },
    allowSelfRegistration: { type: Boolean, default: true },
    themePrimary: { type: String, default: "#C8891B" },
  },
  { timestamps: true },
);

export const GymSettings: Model<GymSettingsDoc> =
  mongoose.models.GymSettings ?? mongoose.model<GymSettingsDoc>("GymSettings", GymSettingsSchema);

export async function getSettings(): Promise<GymSettingsDoc> {
  const { connectDB } = await import("@/lib/db");
  await connectDB();
  let s = await GymSettings.findOne().lean();
  if (!s) {
    const created = await GymSettings.create({});
    s = created.toObject() as any;
  }
  return s as unknown as GymSettingsDoc;
}

/** Settings shape safe to expose publicly (no secrets). */
export function publicSettings(s: GymSettingsDoc) {
  return {
    gymName: s.gymName, tagline: s.tagline, logoUrl: s.logoUrl, address: s.address, city: s.city,
    phone: s.phone, email: s.email, website: s.website, social: s.social, currency: s.currency,
    timezone: s.timezone, taxLabel: s.taxLabel, openingHours: s.openingHours, facilities: s.facilities,
    trainersPublic: s.trainersPublic, testimonials: s.testimonials, faqs: s.faqs, hero: s.hero,
    gallery: s.gallery, mapLink: s.mapLink, membershipPolicy: s.membershipPolicy,
    cancellationPolicy: s.cancellationPolicy, refundPolicy: s.refundPolicy, privacyPolicy: s.privacyPolicy,
    terms: s.terms, allowSelfRegistration: s.allowSelfRegistration, themePrimary: s.themePrimary,
  };
}

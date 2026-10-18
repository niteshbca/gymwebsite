import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { Branch } from "../src/models/Branch";

// Load .env (no dotenv dependency) so `npm run seed` works standalone.
try {
  const raw = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {}
import { MembershipPlan } from "../src/models/MembershipPlan";
import { ClassModel } from "../src/models/Class";
import { GymSettings } from "../src/models/GymSettings";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fitpro";

async function main() {
  await mongoose.connect(uri);
  console.log("connected");

  // Branch
  const branch = await Branch.findOneAndUpdate(
    { code: "HQ" },
    { code: "HQ", name: "FitPro Downtown", address: "12 Fitness Avenue, Andheri West", city: "Mumbai", phone: "+91 98765 43210", email: "hello@fitpro.local", active: true },
    { upsert: true, new: true },
  );

  // Plans
  const plans = [
    { name: "Starter Monthly", code: "STARTER1M", description: "Gym floor + basic consultation", priceMinor: 199900, durationValue: 1, durationUnit: "month", category: "membership", includedSessions: 0, classAccess: "none", freezeAllowed: false, sortOrder: 1 },
    { name: "Pro Quarterly", code: "PRO3M", description: "Unlimited gym + all group classes", priceMinor: 549900, durationValue: 3, durationUnit: "month", category: "membership", includedSessions: 2, classAccess: "all", freezeAllowed: true, sortOrder: 2 },
    { name: "Elite Yearly", code: "ELITE1Y", description: "Everything + 12 PT sessions", priceMinor: 1999900, durationValue: 1, durationUnit: "year", category: "membership", includedSessions: 12, classAccess: "all", branchAccess: "all", freezeAllowed: true, maxFreezes: 3, trainerIncluded: true, sortOrder: 3, joiningFeeMinor: 99900 },
  ];
  await MembershipPlan.deleteMany({});
  await MembershipPlan.insertMany(plans.map((p) => ({ ...p, active: true, archived: false })));

  // Classes
  await ClassModel.deleteMany({});
  await ClassModel.insertMany([
    { name: "Morning Yoga", description: "Gentle flow and stretch", branch: branch._id, room: "Studio A", capacity: 25, dayOfWeek: 1, startTime: "07:00", endTime: "08:00", active: true },
    { name: "HIIT Blast", description: "High intensity interval training", branch: branch._id, room: "Main Floor", capacity: 20, dayOfWeek: 3, startTime: "18:30", endTime: "19:30", active: true },
    { name: "Zumba Party", description: "Dance fitness", branch: branch._id, room: "Studio B", capacity: 30, dayOfWeek: 5, startTime: "19:00", endTime: "20:00", active: true },
  ]);

  // Settings with images
  const s = { gymName: "NiteshPro", tagline: "Train Hard. Live Strong.", logoUrl: "", address: "NiteshPro Fitness Studio", city: "India", phone: "+91 8810751872", email: "nitesh@niteshpro.in", website: "https://niteshpro.in", social: { facebook: "https://facebook.com", instagram: "https://instagram.com", youtube: "https://youtube.com", twitter: "https://twitter.com" }, currency: "INR", timezone: "Asia/Kolkata", taxLabel: "GST", hero: { title: "Stronger Every Single Day", subtitle: "Premium coaching, science-backed programs and a community that shows up. Your first step starts here.", ctaText: "Start Free Enquiry", imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80" }, facilities: [ { title: "Strength Floor", description: "Olympic racks, free weights and plate-loaded machines.", icon: "dumbbell" }, { title: "Cardio Zone", description: "Treadmills, cycles and rowers with entertainment screens.", icon: "heart" }, { title: "Group Studio", description: "Yoga, Zumba, HIIT and functional classes daily.", icon: "users" }, { title: "Recovery", description: "Sauna, steam and stretching area.", icon: "sparkles" } ], trainersPublic: [ { name: "Rohan Mehta", specialty: "Strength & Conditioning", photo: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=400&q=80", bio: "10+ years coaching athletes." }, { name: "Priya Nair", specialty: "Yoga & Mobility", photo: "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=400&q=80", bio: "Certified RYT-500." } ], testimonials: [ { name: "Ananya S.", quote: "Lost 12kg in 6 months. Trainers actually care.", rating: 5 }, { name: "Rahul M.", quote: "Best equipment and crowd. Renewed yearly.", rating: 5 } ], faqs: [ { question: "Do you offer a trial class?", answer: "Yes - submit the enquiry form and our team will schedule a free trial." }, { question: "Can I freeze my membership?", answer: "Most plans allow up to 2 freezes." }, { question: "What payment methods do you accept?", answer: "Cash, UPI, card and bank transfer." } ], gallery: [ { url: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=600&q=80", caption: "Main floor" }, { url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80", caption: "Strength" }, { url: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=600&q=80", caption: "Cardio" } ], mapLink: "https://maps.google.com", expiryReminderWindowsDays: [7, 3, 1], allowPartialPayments: true, allowSelfRegistration: true, themePrimary: "#16a34a" } as any;

  // Remove conflicting duplicate key by constructing properly
  const facilities = [ { title: "Strength Floor", description: "Olympic racks, free weights and plate-loaded machines.", icon: "dumbbell" }, { title: "Cardio Zone", description: "Treadmills, cycles and rowers with entertainment screens.", icon: "heart" }, { title: "Group Studio", description: "Yoga, Zumba, HIIT and functional classes daily.", icon: "users" }, { title: "Recovery", description: "Sauna, steam and stretching area.", icon: "sparkles" } ];
  const payload: any = { ...s, facilities };

  let doc = await GymSettings.findOne();
  if (!doc) doc = await GymSettings.create({});
  doc.set(payload);
  await doc.save();

  console.log("seeded");
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

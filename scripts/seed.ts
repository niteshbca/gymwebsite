import fs from "node:fs";
import path from "node:path";
import mongoose, { Types } from "mongoose";

// Load .env (no dotenv dependency) so `npm run seed` works standalone.
try {
  const raw = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {}

import { hashPassword } from "../src/lib/password";
import { Branch } from "../src/models/Branch";
import { MembershipPlan, computePlanEndDate } from "../src/models/MembershipPlan";
import { ClassModel, ClassBooking } from "../src/models/Class";
import { GymSettings } from "../src/models/GymSettings";
import { User } from "../src/models/User";
import { TrainerProfile } from "../src/models/TrainerProfile";
import { MemberProfile } from "../src/models/MemberProfile";
import { Subscription } from "../src/models/Subscription";
import { Invoice, Payment } from "../src/models/Payment";
import { Attendance } from "../src/models/Attendance";
import { Lead } from "../src/models/Lead";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fitpro";

const img = (id: string, w = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const avatar = (n: number) => `https://i.pravatar.cc/200?img=${n}`;

const CLASS_IMAGES: Record<string, string> = {
  yoga: img("1544367567-0f2fcb009e0b"),
  hiit: img("1571019613454-1cb2f99b2d8b"),
  zumba: img("1518611012118-696072aa579a"),
  spin: img("1534258936925-c58bed479fcb"),
  strength: img("1534438327276-14e5300c3a48"),
  boxing: img("1549719386-74dfcbf7dbed"),
  pilates: img("1518310383802-640c2de311b2"),
  crossfit: img("1526506118085-60ce8714f8c5"),
  stretch: img("1591258370814-01609b341790"),
  functional: img("1517836357463-d25dfeac3438"),
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Rohan", "Arjun", "Rahul", "Ananya", "Diya", "Ira", "Meera", "Nisha", "Priya", "Sneha", "Karan", "Manish", "Pooja", "Sanya", "Zara"];
const LAST = ["Sharma", "Verma", "Patel", "Reddy", "Nair", "Gupta", "Singh", "Mehta", "Iyer", "Joshi"];
const GUESTS = [
  { name: "Tanvi Kapoor", email: "tanvi.kapoor@example.com", phone: "+91 98111 22331" },
  { name: "Siddharth Rao", email: "sid.rao@example.com", phone: "+91 98222 33442" },
  { name: "Neha Gupta", email: "neha.gupta@example.com", phone: "+91 98333 44553" },
  { name: "Aman Trivedi", email: "aman.trivedi@example.com", phone: "+91 98444 55664" },
  { name: "Ritika Das", email: "ritika.das@example.com", phone: "+91 98555 66775" },
  { name: "Mohit Bansal", email: "mohit.bansal@example.com", phone: "+91 98666 77886" },
  { name: "Kavya Menon", email: "kavya.menon@example.com", phone: "+91 98777 88997" },
  { name: "Dev Malhotra", email: "dev.malhotra@example.com", phone: "+91 98888 99008" },
  { name: "Aisha Khan", email: "aisha.khan@example.com", phone: "+91 98999 00119" },
  { name: "Yash Patil", email: "yash.patil@example.com", phone: "+91 98000 11220" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextWeekday(dayOfWeek: number, weeksAhead = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff + weeksAhead * 7);
  return d;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function passCode() {
  const r = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FP-${r()}-${r()}`;
}

async function main() {
  await mongoose.connect(uri);
  console.log("connected to", uri.replace(/\/\/[^@]+@/, "//***@"));

  // ---------- Branches ----------
  const branch = await Branch.findOneAndUpdate(
    { code: "HQ" },
    {
      code: "HQ", name: "NiteshPro Downtown", address: "12 Fitness Avenue, Andheri West",
      city: "Mumbai", phone: "+91 88107 51872", email: "hello@niteshpro.in", active: true,
    },
    { upsert: true, new: true },
  );
  const branch2 = await Branch.findOneAndUpdate(
    { code: "WEST" },
    {
      code: "WEST", name: "NiteshPro Westside", address: "45 Link Road, Borivali",
      city: "Mumbai", phone: "+91 88107 51873", email: "west@niteshpro.in", active: true,
    },
    { upsert: true, new: true },
  );

  // ---------- Settings ----------
  const settingsPayload: any = {
    gymName: "NiteshPro",
    tagline: "Strength. Style. Discipline.",
    logoUrl: "",
    address: "NiteshPro Fitness Studio, 12 Fitness Avenue",
    city: "Mumbai",
    phone: "+91 8810751872",
    email: "nitesh@niteshpro.in",
    website: "https://niteshpro.in",
    social: { facebook: "https://facebook.com", instagram: "https://instagram.com", youtube: "https://youtube.com", twitter: "https://twitter.com" },
    currency: "INR",
    timezone: "Asia/Kolkata",
    taxLabel: "GST",
    hero: {
      title: "Unleash Your Strongest Self",
      subtitle: "Elite coaches, boutique equipment and members-only experiences. Book a free class online — your strongest self starts here.",
      ctaText: "Claim Your Free Trial",
      imageUrl: img("1534438327276-14e5300c3a48", 1600),
    },
    facilities: [
      { title: "Strength Floor", description: "Olympic racks, free weights and plate-loaded machines.", icon: "dumbbell" },
      { title: "Cardio Zone", description: "Treadmills, cycles and rowers with entertainment screens.", icon: "heart" },
      { title: "Group Studio", description: "Yoga, Zumba, HIIT and functional classes daily.", icon: "users" },
      { title: "Recovery", description: "Sauna, steam and stretching area.", icon: "sparkles" },
    ],
    trainersPublic: [
      { name: "Rohan Mehta", specialty: "Strength & Conditioning", photo: img("1567013127542-490d757e51fc", 400), bio: "10+ years coaching athletes. Ex-national powerlifter." },
      { name: "Priya Nair", specialty: "Yoga & Mobility", photo: img("1594381898411-846e7d193883", 400), bio: "Certified RYT-500. Calm body, focused mind." },
      { name: "Arjun Sidhu", specialty: "Boxing & HIIT", photo: img("1583454110551-21f2fa2afe61", 400), bio: "Former state boxing champion. Bring your energy." },
      { name: "Meera Joshi", specialty: "Pilates & Core", photo: img("1594737625785-a6cbdabd333c", 400), bio: "Rehab-focused movement specialist." },
    ],
    testimonials: [
      { name: "Ananya S.", quote: "Lost 12kg in 6 months. Trainers actually care and the class booking system is so easy.", rating: 5 },
      { name: "Rahul M.", quote: "Best equipment and crowd. Renewed yearly — the HIIT classes are addictive.", rating: 5 },
      { name: "Pooja K.", quote: "Booked my trial class online, got the pass on email instantly. Smooth experience.", rating: 5 },
      { name: "Karan D.", quote: "Personal training transformed my posture. Worth every rupee.", rating: 4 },
      { name: "Sneha R.", quote: "Clean facility, amazing Zumba sessions and friendly front desk.", rating: 5 },
    ],
    faqs: [
      { question: "Do you offer a trial class?", answer: "Yes — pick any class on the Classes page and book online. Our team confirms by email with a digital pass." },
      { question: "How does online class booking work?", answer: "Choose a class and date on the website, submit your details, and our staff approves the request. You then receive an email with a QR entry pass." },
      { question: "Can I freeze my membership?", answer: "Most plans allow up to 2 freezes of 15 days each. Contact the front desk before your expiry date." },
      { question: "What payment methods do you accept?", answer: "Cash, UPI, card and bank transfer." },
      { question: "Are personal training sessions included?", answer: "Elite and PT plans include sessions with a dedicated coach. Other plans can add them any time." },
    ],
    gallery: [
      { url: img("1571902943202-507ec2618e8f", 600), caption: "Main floor" },
      { url: img("1517836357463-d25dfeac3438", 600), caption: "Strength zone" },
      { url: img("1540497077202-7c8a3999166f", 600), caption: "Cardio deck" },
      { url: img("1534438327276-14e5300c3a48", 600), caption: "Free weights" },
      { url: img("1518611012118-696072aa579a", 600), caption: "Studio A" },
      { url: img("1571019614242-c5c5dee9f50b", 600), caption: "Group class" },
    ],
    mapLink: "https://maps.google.com",
    expiryReminderWindowsDays: [7, 3, 1],
    allowPartialPayments: true,
    allowSelfRegistration: true,
    themePrimary: "#C8891B",
    openingHours: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({ day, open: "06:00", close: "22:00", closed: false }))
      .concat([{ day: "Sun", open: "07:00", close: "13:00", closed: false }]),
  };
  let settingsDoc = await GymSettings.findOne();
  if (!settingsDoc) settingsDoc = await GymSettings.create({});
  settingsDoc.set(settingsPayload);
  await settingsDoc.save();

  // ---------- Users: staff ----------
  const pw = async (s: string) => hashPassword(s);
  const adminHash = await pw("Admin@1234");
  const trainerHash = await pw("Trainer@1234");
  const staffHash = await pw("Front@1234");
  const memberHash = await pw("Member@1234");

  const admin = await User.findOneAndUpdate(
    { email: "admin@niteshpro.in" },
    {
      email: "admin@niteshpro.in", passwordHash: adminHash, name: "Nitesh Kumar", phone: "+91 88107 51872",
      role: "super_admin", branch: branch._id, status: "active", emailVerifiedAt: new Date(), permissions: [],
    },
    { upsert: true, new: true },
  );
  await User.findOneAndUpdate(
    { email: "frontdesk@niteshpro.in" },
    {
      email: "frontdesk@niteshpro.in", passwordHash: staffHash, name: "Reception Desk", phone: "+91 88107 51873",
      role: "receptionist", branch: branch._id, status: "active", emailVerifiedAt: new Date(), permissions: [],
    },
    { upsert: true, new: true },
  );

  // ---------- Trainers ----------
  await TrainerProfile.deleteMany({});
  const trainerDefs = [
    { name: "Rohan Mehta", specialty: "Strength & Conditioning", photo: img("1567013127542-490d757e51fc", 400), bio: "10+ years coaching athletes. Ex-national powerlifter.", rate: 250000 },
    { name: "Priya Nair", specialty: "Yoga & Mobility", photo: img("1594381898411-846e7d193883", 400), bio: "Certified RYT-500. Calm body, focused mind.", rate: 180000 },
    { name: "Arjun Sidhu", specialty: "Boxing & HIIT", photo: img("1583454110551-21f2fa2afe61", 400), bio: "Former state boxing champion.", rate: 220000 },
    { name: "Meera Joshi", specialty: "Pilates & Core", photo: img("1594737625785-a6cbdabd333c", 400), bio: "Rehab-focused movement specialist.", rate: 200000 },
    { name: "Vikram Rao", specialty: "CrossFit & Functional", photo: img("1567013127542-490d757e51fc", 401), bio: "CF-L2 coach. Obsessed with form.", rate: 210000 },
    { name: "Sana Sheikh", specialty: "Zumba & Dance Fitness", photo: img("1518310383802-640c2de311b2", 400), bio: "ZIN member. Every class is a party.", rate: 160000 },
  ];
  const trainers: any[] = [];
  for (const [i, t] of trainerDefs.entries()) {
    const email = `${t.name.toLowerCase().replace(/[^a-z]+/g, ".")}@niteshpro.in`;
    const user = await User.findOneAndUpdate(
      { email },
      {
        email, passwordHash: trainerHash, name: t.name, phone: `+91 98${100 + i} 1${1000 + i}`,
        role: "trainer", branch: i % 2 === 0 ? branch._id : branch2._id, status: "active", emailVerifiedAt: new Date(), permissions: [],
      },
      { upsert: true, new: true },
    );
    const profile = await TrainerProfile.create({
      user: user._id, branch: i % 2 === 0 ? branch._id : branch2._id, name: t.name,
      phone: `+91 98${100 + i} 1${1000 + i}`, email, specialties: [t.specialty],
      qualifications: ["Certified Personal Trainer"], bio: t.bio, photo: t.photo,
      sessionRateMinor: t.rate, compensationType: "per_session", compensationValueMinor: Math.round(t.rate * 0.4),
      availability: [{ day: "Mon", from: "06:00", to: "22:00" }, { day: "Wed", from: "06:00", to: "22:00" }, { day: "Fri", from: "06:00", to: "22:00" }],
      active: true,
    });
    trainers.push(profile);
  }

  // ---------- Plans ----------
  await MembershipPlan.deleteMany({});
  const planDefs = [
    { name: "Starter Monthly", code: "STARTER1M", description: "Gym floor + basic consultation", priceMinor: 199900, durationValue: 1, durationUnit: "month", classAccess: "none", includedSessions: 0, freezeAllowed: false, popular: false, image: img("1534438327276-14e5300c3a48", 600), features: ["Gym floor access", "Body composition check", "Locker access"] },
    { name: "Pro Quarterly", code: "PRO3M", description: "Unlimited gym + all group classes", priceMinor: 549900, durationValue: 3, durationUnit: "month", classAccess: "all", includedSessions: 2, freezeAllowed: true, popular: true, image: img("1571902943202-507ec2618e8f", 600), features: ["Unlimited gym access", "All group classes", "2 PT sessions", "1 freeze allowed", "Nutrition guide"] },
    { name: "Elite Yearly", code: "ELITE1Y", description: "Everything + 12 PT sessions", priceMinor: 1999900, durationValue: 1, durationUnit: "year", classAccess: "all", includedSessions: 12, freezeAllowed: true, popular: false, joiningFeeMinor: 99900, image: img("1540497077202-7c8a3999166f", 600), features: ["Everything in Pro", "12 PT sessions", "All branches access", "3 freezes allowed", "Sauna & steam", "Guest passes"] },
    { name: "PT Pack 10", code: "PT10", description: "10 personal training sessions", priceMinor: 1499900, durationValue: 3, durationUnit: "month", category: "personal_training", classAccess: "none", includedSessions: 10, freezeAllowed: false, popular: false, image: img("1571019613454-1cb2f99b2d8b", 600), features: ["10 one-on-one sessions", "Custom program", "Monthly progress report"] },
    { name: "Student Half-Yearly", code: "STUD6M", description: "Special student pricing, 6 months", priceMinor: 799900, durationValue: 6, durationUnit: "month", classAccess: "group", includedSessions: 0, freezeAllowed: true, popular: false, image: img("1518611012118-696072aa579a", 600), features: ["Gym + group classes", "Student ID required", "1 freeze allowed"] },
    { name: "Drop-in Class", code: "DROPIN", description: "Single group class trial", priceMinor: 49900, durationValue: 1, durationUnit: "day", category: "class_package", classAccess: "group", includedSessions: 0, freezeAllowed: false, popular: false, image: img("1534258936925-c58bed479fcb", 600), features: ["Any one group class", "Valid for one day"] },
  ];
  const plans = await MembershipPlan.insertMany(
    planDefs.map((p: any, i) => ({ ...p, active: true, archived: false, sortOrder: i, category: p.category ?? "membership" })),
  );
  const planByCode = (code: string) => plans.find((p) => p.code === code)!;

  // ---------- Classes ----------
  await ClassBooking.deleteMany({});
  await ClassModel.deleteMany({});
  const classDefs = [
    { name: "Morning Yoga", description: "Gentle flow, breathwork and mobility to start your day.", dayOfWeek: 1, startTime: "07:00", endTime: "08:00", room: "Studio A", capacity: 25, trainer: 1, intensity: "Beginner", image: CLASS_IMAGES.yoga },
    { name: "Sunrise HIIT", description: "High intensity intervals — torch calories before work.", dayOfWeek: 1, startTime: "18:30", endTime: "19:30", room: "Main Floor", capacity: 20, trainer: 2, intensity: "Advanced", image: CLASS_IMAGES.hiit },
    { name: "Power Strength", description: "Barbell fundamentals: squat, bench, deadlift with coaching.", dayOfWeek: 2, startTime: "18:00", endTime: "19:15", room: "Strength Zone", capacity: 12, trainer: 0, intensity: "Intermediate", image: CLASS_IMAGES.strength },
    { name: "Zumba Party", description: "Dance fitness — no experience needed, just energy.", dayOfWeek: 3, startTime: "19:00", endTime: "20:00", room: "Studio B", capacity: 30, trainer: 5, intensity: "All levels", image: CLASS_IMAGES.zumba },
    { name: "Boxing Basics", description: "Stance, footwork and pad work. Great stress buster.", dayOfWeek: 3, startTime: "20:00", endTime: "21:00", room: "Combat Room", capacity: 16, trainer: 2, intensity: "Intermediate", image: CLASS_IMAGES.boxing },
    { name: "Spin Burn", description: "Indoor cycling intervals with live music energy.", dayOfWeek: 4, startTime: "07:00", endTime: "07:45", room: "Cycle Studio", capacity: 22, trainer: 4, intensity: "Advanced", image: CLASS_IMAGES.spin },
    { name: "Pilates Core", description: "Mat pilates for deep core, posture and back health.", dayOfWeek: 4, startTime: "18:30", endTime: "19:30", room: "Studio A", capacity: 18, trainer: 3, intensity: "Beginner", image: CLASS_IMAGES.pilates },
    { name: "CrossFit WOD", description: "Workout of the day — scaled for every level.", dayOfWeek: 5, startTime: "06:30", endTime: "07:30", room: "Box Area", capacity: 15, trainer: 4, intensity: "Advanced", image: CLASS_IMAGES.crossfit },
    { name: "Functional Circuit", description: "Kettlebells, ropes and sleds — train like you move.", dayOfWeek: 5, startTime: "19:00", endTime: "20:00", room: "Main Floor", capacity: 20, trainer: 0, intensity: "Intermediate", image: CLASS_IMAGES.functional },
    { name: "Weekend Stretch & Recover", description: " guided mobility and foam rolling session.", dayOfWeek: 6, startTime: "09:00", endTime: "10:00", room: "Studio A", capacity: 24, trainer: 1, intensity: "All levels", image: CLASS_IMAGES.stretch },
    { name: "Saturday Zumba", description: "Weekend dance party — bring a friend.", dayOfWeek: 6, startTime: "18:00", endTime: "19:00", room: "Studio B", capacity: 30, trainer: 5, intensity: "All levels", image: CLASS_IMAGES.zumba },
    { name: "Express Lunch HIIT", description: "45-minute desk-break burner. Shower provided.", dayOfWeek: 2, startTime: "12:30", endTime: "13:15", room: "Main Floor", capacity: 18, trainer: 2, intensity: "Intermediate", image: CLASS_IMAGES.hiit },
  ];
  const classes = await ClassModel.insertMany(
    classDefs.map((c: any) => ({
      name: c.name, description: c.description, image: c.image, intensity: c.intensity,
      branch: branch._id, trainer: trainers[c.trainer]?._id ?? null, room: c.room, capacity: c.capacity,
      waitlistCapacity: 5, dayOfWeek: c.dayOfWeek, startTime: c.startTime, endTime: c.endTime,
      bookingWindowHours: 48, cancelCutoffHours: 2, requiresPlanAccess: false, active: true,
    })),
  );

  // ---------- Members ----------
  const members: any[] = [];
  const usedEmails = new Set<string>();
  for (let i = 0; i < 16; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i ? i : ""}@example.com`;
    if (usedEmails.has(email)) continue;
    usedEmails.add(email);
    const joinDate = new Date();
    joinDate.setDate(joinDate.getDate() - Math.floor(Math.random() * 300) - 5);
    const user = await User.findOneAndUpdate(
      { email },
      {
        email, passwordHash: memberHash, name: `${first} ${last}`, phone: `+91 97${500 + i} 6${1000 + i}`,
        role: "member", branch: branch._id, status: "active", emailVerifiedAt: new Date(), permissions: [],
      },
      { upsert: true, new: true },
    );
    const profile = await MemberProfile.create({
      memberNumber: `M-${String(1001 + i)}`,
      user: user._id, branch: branch._id, firstName: first, lastName: last,
      photo: avatar((i % 70) + 1), phone: `+91 97${500 + i} 6${1000 + i}`, email,
      address: "Mumbai, India", gender: i % 2 === 0 ? "male" : "female",
      emergencyContactName: `${FIRST[(i + 3) % FIRST.length]} ${last}`, emergencyContactPhone: `+91 90${100 + i} 2${1000 + i}`,
      joinDate, source: pick(["website", "walk_in", "referral", "social"]),
      goals: pick(["Fat loss", "Muscle gain", "General fitness", "Strength", "Endurance"]),
      consentMarketing: true, consentHealthData: true, status: "active",
      assignedTrainer: trainers[i % trainers.length]._id,
    });
    await User.updateOne({ _id: user._id }, { memberProfile: profile._id });
    members.push(profile);
  }

  // ---------- Subscriptions + invoices + payments ----------
  let invoiceSeq = 1001;
  let paymentSeq = 5001;
  const subStatuses = ["active", "active", "active", "active", "expired", "active", "frozen", "active"];
  for (const [i, member] of members.entries()) {
    const plan = i % 5 === 0 ? planByCode("STARTER1M") : i % 5 === 1 ? planByCode("PRO3M") : i % 5 === 2 ? planByCode("ELITE1Y") : i % 5 === 3 ? planByCode("STUD6M") : planByCode("PRO3M");
    const start = new Date(member.joinDate);
    const end = computePlanEndDate(start, plan.durationUnit as any, plan.durationValue);
    const status = end < new Date() ? "expired" : (subStatuses[i % subStatuses.length] as any);
    const base = plan.priceMinor;
    const tax = Math.round((base * (plan.taxPercent ?? 18)) / 100);
    const total = base + tax + (plan.joiningFeeMinor ?? 0);
    const sub = await Subscription.create({
      subscriptionNumber: `SUB-${String(3001 + i)}`,
      member: member._id, branch: branch._id, plan: plan._id,
      planSnapshot: {
        name: plan.name, code: plan.code, durationValue: plan.durationValue, durationUnit: plan.durationUnit,
        priceMinor: plan.priceMinor, taxPercent: plan.taxPercent, taxInclusive: plan.taxInclusive,
        joiningFeeMinor: plan.joiningFeeMinor, freezeAllowed: plan.freezeAllowed, maxFreezes: plan.maxFreezes,
        freezeDaysMax: plan.freezeDaysMax, classAccess: plan.classAccess, accessHours: plan.accessHours ?? null,
      },
      startDate: start, endDate: end, activatedAt: start,
      status: status === "expired" ? "expired" : status,
      trainer: i % 3 === 0 ? trainers[i % trainers.length]._id : null,
      baseMinor: base, discountMinor: 0, taxMinor: tax, joiningFeeMinor: plan.joiningFeeMinor ?? 0,
      totalMinor: total, amountPaidMinor: total, balanceMinor: 0, paymentStatus: "paid",
      freezeCount: 0, frozenDaysTotal: 0, source: i % 4 === 0 ? "online" : "reception",
      notes: "Seeded membership", createdBy: admin._id,
    });
    const invoice = await Invoice.create({
      invoiceNumber: `INV-${invoiceSeq++}`, member: member._id, subscription: sub._id, branch: branch._id,
      items: [{ label: plan.name, quantity: 1, unitMinor: base, totalMinor: base }],
      baseMinor: base, discountMinor: 0, taxMinor: tax, totalMinor: total, paidMinor: total, balanceMinor: 0,
      currency: "INR", status: "paid", issuedAt: start, createdBy: admin._id,
    });
    await Payment.create({
      paymentNumber: `PAY-${paymentSeq++}`, invoice: invoice._id, member: member._id, subscription: sub._id,
      branch: branch._id, amountMinor: total, method: pick(["cash", "upi", "card", "bank_transfer"]),
      status: "success", gateway: "manual", paidAt: start, receivedBy: admin._id, notes: "Seeded payment",
    });
  }

  // ---------- Attendance (last 30 days) ----------
  const attendanceDocs: any[] = [];
  for (const member of members) {
    const days = 6 + Math.floor(Math.random() * 15);
    for (let d = 0; d < days; d++) {
      const when = new Date();
      when.setDate(when.getDate() - d);
      when.setHours(6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60), 0, 0);
      if (when < member.joinDate) continue;
      const out = new Date(when.getTime() + (60 + Math.floor(Math.random() * 60)) * 60000);
      attendanceDocs.push({
        member: member._id, branch: branch._id, checkInAt: when, checkOutAt: out,
        method: pick(["qr", "member_id", "manual", "reception"]), verifiedBy: admin._id,
      });
    }
  }
  if (attendanceDocs.length) await Attendance.insertMany(attendanceDocs);

  // ---------- Class bookings ----------
  // 1) Member bookings (auto-approved) for upcoming sessions
  const bookingDefs: any[] = [];
  let passSeq = 1000;
  for (const member of members.slice(0, 12)) {
    const count = 1 + Math.floor(Math.random() * 2);
    const shuffled = [...classes].sort(() => Math.random() - 0.5);
    for (const cls of shuffled.slice(0, count)) {
      const occurrence = nextWeekday(cls.dayOfWeek, Math.random() > 0.5 ? 0 : 1);
      bookingDefs.push({
        class: cls._id, occurrenceDate: occurrence, member: member._id, status: "booked",
        source: "member", passCode: `FP-${String(++passSeq).slice(-4)}-MEM${Math.floor(Math.random() * 900 + 100)}`,
        bookedAt: new Date(Date.now() - Math.floor(Math.random() * 5) * 86400000),
      });
    }
  }
  // 2) Website booking requests: pending + approved + a couple rejected
  for (const [i, g] of GUESTS.entries()) {
    const cls = classes[i % classes.length];
    const occurrence = nextWeekday(cls.dayOfWeek, Math.floor(i / 4));
    const roll = i % 5;
    const status = roll === 4 ? "rejected" : roll === 3 ? "booked" : "pending";
    bookingDefs.push({
      class: cls._id, occurrenceDate: occurrence, member: null, status,
      source: "website", guestName: g.name, guestEmail: g.email, guestPhone: g.phone,
      notes: i === 0 ? "First visit — is parking available?" : "",
      passCode: `FP-${String(++passSeq).slice(-4)}-WEB`,
      bookedAt: new Date(Date.now() - Math.floor(Math.random() * 3) * 86400000),
      reviewedAt: status === "pending" ? null : new Date(),
      reviewedBy: status === "pending" ? null : admin._id,
      rejectReason: status === "rejected" ? "Session cancelled due to low energy demand." : "",
    });
  }
  if (bookingDefs.length) await ClassBooking.insertMany(bookingDefs);

  // ---------- Leads ----------
  await Lead.deleteMany({});
  const leadStatuses = ["new", "contacted", "trial", "negotiation", "converted", "lost"];
  await Lead.insertMany(
    GUESTS.map((g, i) => ({
      name: g.name, phone: g.phone, email: g.email,
      interestedPlan: plans[i % plans.length]._id, source: pick(["website", "call", "walk_in", "social"]),
      branch: branch._id, status: leadStatuses[i % leadStatuses.length],
      followUpDate: new Date(Date.now() + (i % 7) * 86400000),
      notes: "Seeded lead", history: [{ at: new Date(), by: "seed", from: "", to: "new", note: "Seeded" }],
    })),
  );

  // ---------- Summary ----------
  const [mCount, sCount, bCount, pendCount, aCount, pCount] = await Promise.all([
    MemberProfile.countDocuments({}), Subscription.countDocuments({}), ClassBooking.countDocuments({}),
    ClassBooking.countDocuments({ status: "pending" }), Attendance.countDocuments({}), Payment.countDocuments({}),
  ]);
  console.log("\n=== Seed complete ===");
  console.log(`Members: ${mCount} | Subscriptions: ${sCount} | Bookings: ${bCount} (${pendCount} pending)`);
  console.log(`Attendance: ${aCount} | Payments: ${pCount} | Classes: ${classes.length} | Plans: ${plans.length} | Trainers: ${trainers.length}`);
  console.log("\nLogins:");
  console.log("  Admin:      admin@niteshpro.in / Admin@1234");
  console.log("  Reception:  frontdesk@niteshpro.in / Front@1234");
  console.log("  Trainer:    rohan.mehta@niteshpro.in / Trainer@1234");
  console.log("  Member:     aarav.sharma@example.com / Member@1234");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

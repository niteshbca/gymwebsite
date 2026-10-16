import mongoose, { Schema, type Model } from "mongoose";

export interface ExerciseDoc extends mongoose.Document {
  name: string;
  muscleGroup: string;
  instructions: string;
  defaultSets: number;
  defaultReps: string;
  durationSeconds: number;
  restSeconds: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  equipment: string;
  mediaUrl: string;
  active: boolean;
}

const ExerciseSchema = new Schema<ExerciseDoc>(
  {
    name: { type: String, required: true, trim: true },
    muscleGroup: { type: String, required: true, index: true },
    instructions: { type: String, default: "" },
    defaultSets: { type: Number, default: 3 },
    defaultReps: { type: String, default: "12" },
    durationSeconds: { type: Number, default: 0 },
    restSeconds: { type: Number, default: 60 },
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    equipment: { type: String, default: "" },
    mediaUrl: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
ExerciseSchema.index({ name: "text", muscleGroup: "text" });

export const Exercise: Model<ExerciseDoc> = mongoose.models.Exercise ?? mongoose.model<ExerciseDoc>("Exercise", ExerciseSchema);

export interface WorkoutPlanDoc extends mongoose.Document {
  name: string;
  member: mongoose.Types.ObjectId | null; // null = reusable template
  trainer: mongoose.Types.ObjectId | null;
  branch: mongoose.Types.ObjectId | null;
  startDate: Date;
  endDate: Date | null;
  isTemplate: boolean;
  days: {
    day: string;
    focus: string;
    exercises: { exercise: mongoose.Types.ObjectId; sets: number; reps: string; restSeconds: number; notes: string }[];
  }[];
  dietNotes: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkoutPlanSchema = new Schema<WorkoutPlanDoc>(
  {
    name: { type: String, required: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", default: null, index: true },
    trainer: { type: Schema.Types.ObjectId, ref: "TrainerProfile", default: null },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    isTemplate: { type: Boolean, default: false },
    days: {
      type: [
        {
          day: String,
          focus: String,
          exercises: [{ exercise: { type: Schema.Types.ObjectId, ref: "Exercise" }, sets: Number, reps: String, restSeconds: Number, notes: String }],
        },
      ],
      default: [],
    },
    dietNotes: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const WorkoutPlan: Model<WorkoutPlanDoc> =
  mongoose.models.WorkoutPlan ?? mongoose.model<WorkoutPlanDoc>("WorkoutPlan", WorkoutPlanSchema);

export interface FitnessProgressDoc extends mongoose.Document {
  member: mongoose.Types.ObjectId;
  recordedAt: Date;
  weightKg: number;
  heightCm: number;
  chestCm: number;
  waistCm: number;
  hipsCm: number;
  bicepsCm: number;
  bodyFatPercent: number;
  notes: string;
  recordedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const FitnessProgressSchema = new Schema<FitnessProgressDoc>(
  {
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, index: true },
    recordedAt: { type: Date, required: true, default: Date.now },
    weightKg: { type: Number, default: 0 },
    heightCm: { type: Number, default: 0 },
    chestCm: { type: Number, default: 0 },
    waistCm: { type: Number, default: 0 },
    hipsCm: { type: Number, default: 0 },
    bicepsCm: { type: Number, default: 0 },
    bodyFatPercent: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
FitnessProgressSchema.index({ member: 1, recordedAt: -1 });

export const FitnessProgress: Model<FitnessProgressDoc> =
  mongoose.models.FitnessProgress ?? mongoose.model<FitnessProgressDoc>("FitnessProgress", FitnessProgressSchema);

export interface EquipmentAssetDoc extends mongoose.Document {
  branch: mongoose.Types.ObjectId;
  name: string;
  assetCode: string;
  category: string;
  purchaseDate: Date | null;
  purchaseCostMinor: number;
  warrantyEndsAt: Date | null;
  status: "in_service" | "under_maintenance" | "down" | "retired";
  nextServiceAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const EquipmentAssetSchema = new Schema<EquipmentAssetDoc>(
  {
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    name: { type: String, required: true },
    assetCode: { type: String, required: true, unique: true },
    category: { type: String, default: "" },
    purchaseDate: { type: Date, default: null },
    purchaseCostMinor: { type: Number, default: 0 },
    warrantyEndsAt: { type: Date, default: null },
    status: { type: String, enum: ["in_service", "under_maintenance", "down", "retired"], default: "in_service" },
    nextServiceAt: { type: Date, default: null, index: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const EquipmentAsset: Model<EquipmentAssetDoc> =
  mongoose.models.EquipmentAsset ?? mongoose.model<EquipmentAssetDoc>("EquipmentAsset", EquipmentAssetSchema);

export interface InventoryItemDoc extends mongoose.Document {
  branch: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  costMinor: number;
  priceMinor: number;
  supplier: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<InventoryItemDoc>(
  {
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, default: "" },
    category: { type: String, default: "" },
    unit: { type: String, default: "pcs" },
    quantity: { type: Number, default: 0 },
    reorderThreshold: { type: Number, default: 5 },
    costMinor: { type: Number, default: 0 },
    priceMinor: { type: Number, default: 0 },
    supplier: { type: String, default: "" },
  },
  { timestamps: true },
);

export const InventoryItem: Model<InventoryItemDoc> =
  mongoose.models.InventoryItem ?? mongoose.model<InventoryItemDoc>("InventoryItem", InventoryItemSchema);

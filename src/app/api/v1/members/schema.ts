import { z } from "zod";

export const memberSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).default(""),
  phone: z.string().min(8).max(15),
  email: z.string().email().optional().or(z.literal("")),
  branch: z.string().min(1),
  address: z.string().max(300).default(""),
  dateOfBirth: z.coerce.date().optional().nullable(),
  gender: z.string().max(20).default(""),
  emergencyContactName: z.string().max(80).default(""),
  emergencyContactPhone: z.string().max(15).default(""),
  joinDate: z.coerce.date().default(() => new Date()),
  source: z.enum(["website", "walk_in", "referral", "phone", "campaign"]).default("walk_in"),
  notes: z.string().max(2000).default(""),
  healthInfo: z.string().max(2000).default(""),
  goals: z.string().max(2000).default(""),
  consentMarketing: z.boolean().default(false),
  consentHealthData: z.boolean().default(false),
  assignedTrainer: z.string().nullable().default(null),
  status: z.enum(["active", "inactive", "blocked"]).default("active"),
  customFields: z.record(z.unknown()).default({}),
});

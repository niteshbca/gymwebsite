import { connectDB } from "@/lib/db";
import { ExpenseCategory, Vendor } from "@/models/Lead";
import { withAuth, ok } from "@/lib/api";

export const GET = withAuth("expenses:read", async () => {
  await connectDB();
  const [categories, vendors] = await Promise.all([
    ExpenseCategory.find({ active: true }).lean(),
    Vendor.find({ active: true }).lean(),
  ]);
  return ok({ categories, vendors });
});

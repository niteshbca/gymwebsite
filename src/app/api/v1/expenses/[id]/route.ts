import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Expense } from "@/models/Lead";
import { withAuth, ok, notFound, forbidden, audit, scopeFor } from "@/lib/api";
import { isSuperScoped } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth("expenses:read", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const e = await Expense.findById(id).populate("category", "name").populate("vendor", "name").lean();
  if (!e) throw notFound("Expense not found");
  if (!isSuperScoped(user.role) && String(e.branch) !== user.branch) throw forbidden();
  return ok({ ...e, id: String(e._id) });
});

export const PATCH = withAuth("expenses:update", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const e = await Expense.findById(id);
  if (!e) throw notFound("Expense not found");
  if (!isSuperScoped(user.role) && String(e.branch) !== user.branch) throw forbidden();
  const body = z.object({
    title: z.string().min(2).max(150).optional(),
    amountMinor: z.number().int().min(1).optional(),
    date: z.coerce.date().optional(),
    category: z.string().optional(),
    vendor: z.string().nullable().optional(),
    paymentMethod: z.string().optional(),
    billNumber: z.string().max(60).optional(),
    notes: z.string().max(1000).optional(),
    status: z.enum(["pending", "approved", "rejected", "paid"]).optional(),
  }).parse(await req.json());
  if (body.status === "approved" && e.status === "pending") e.approvedBy = null;
  Object.assign(e, body);
  if (body.status === "approved") {
    const { Types } = await import("mongoose");
    e.approvedBy = new Types.ObjectId(user.id);
  }
  await e.save();
  await audit(user, "expense.update", "Expense", id, { status: e.status });
  return ok({ ...e.toObject(), id: String(e._id) });
});

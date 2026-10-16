import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { withAuth, ok, notFound, forbidden, audit } from "@/lib/api";
import { toSubscriptionJSON, transitionSubscription, freezeSubscription, unfreezeSubscription, cancelSubscription, extendSubscription } from "@/server/services/subscription";
import { isSuperScoped } from "@/lib/rbac";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { MemberProfile } from "@/models/MemberProfile";
import { fmtDate } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw notFound("Subscription not found");
  const sub = await Subscription.findById(id);
  if (!sub) throw notFound("Subscription not found");
  return sub;
}

export const GET = withAuth("subscriptions:read", async (_req: NextRequest, ctx: Ctx, user) => {
  const { id } = await ctx.params;
  const sub = await load(id);
  if (!isSuperScoped(user.role) && String(sub.branch) !== user.branch) throw forbidden();
  return ok(toSubscriptionJSON(sub));
});

const patchSchema = z.object({
  action: z.enum(["activate", "unfreeze", "cancel", "extend", "mark_pending", "reactivate"]),
  days: z.number().int().min(1).max(365).optional(),
  reason: z.string().max(500).default(""),
  startDate: z.coerce.date().optional(),
});

export const PATCH = withAuth("subscriptions:update", async (req: NextRequest, ctx: Ctx, user) => {
  const { id } = await ctx.params;
  const sub = await load(id);
  if (!isSuperScoped(user.role) && String(sub.branch) !== user.branch) throw forbidden();
  const body = patchSchema.parse(await req.json());

  switch (body.action) {
    case "activate": {
      if (!sub.startDate) throw notFound();
      await transitionSubscription(sub, "active", { activatedAt: sub.activatedAt ?? new Date() });
      const member = await MemberProfile.findById(sub.member).lean();
      if (member?.email) {
        const tpl = emailTemplates.membershipActivated(
          `${member.firstName} ${member.lastName}`.trim(),
          sub.planSnapshot.name,
          fmtDate(sub.endDate),
        );
        await sendMail({ to: member.email, subject: tpl.subject, html: tpl.html, template: "membership_activated", entityId: String(sub._id) });
      }
      break;
    }
    case "unfreeze":
      await unfreezeSubscription(sub);
      break;
    case "cancel": {
      const { can } = await import("@/lib/rbac");
      if (!can(user.role, "subscriptions:cancel", user.permissions)) throw forbidden();
      await cancelSubscription(sub, body.reason || "Cancelled by staff");
      break;
    }
    case "extend":
      if (!body.days) throw forbidden("days required");
      await extendSubscription(sub, body.days, body.reason || "Manual extension");
      break;
    case "mark_pending":
      await transitionSubscription(sub, "pending");
      break;
    case "reactivate": {
      if (sub.status !== "cancelled" && sub.status !== "expired") throw forbidden("Only cancelled/expired can be reactivated");
      await transitionSubscription(sub, "active");
      break;
    }
  }
  await audit(user, `subscription.${body.action}`, "Subscription", id, { reason: body.reason, days: body.days });
  const fresh = await load(id);
  return ok(toSubscriptionJSON(fresh));
});

const freezeSchema = z.object({ days: z.number().int().min(1).max(365), reason: z.string().max(300).default("") });

export const POST = withAuth("subscriptions:update", async (req: NextRequest, ctx: Ctx, user) => {
  const { id } = await ctx.params;
  const sub = await load(id);
  if (!isSuperScoped(user.role) && String(sub.branch) !== user.branch) throw forbidden();
  const body = freezeSchema.parse(await req.json());
  await freezeSubscription(sub, body.days, body.reason);
  await audit(user, "subscription.freeze", "Subscription", id, { days: body.days });
  const fresh = await load(id);
  return ok(toSubscriptionJSON(fresh));
});

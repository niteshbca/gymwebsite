import nodemailer from "nodemailer";
import { env, usesRealSmtp } from "./env";

export type MailResult =
  | { ok: true; messageId: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!usesRealSmtp) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Send an email and record the outcome truthfully. When SMTP is not
 * configured the result is "skipped" — we NEVER claim delivery.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
  entityId?: string;
}): Promise<MailResult> {
  const { connectDB } = await import("./db");
  await connectDB();
  const { EmailLog } = await import("@/models/System");

  const base = {
    to: opts.to,
    from: env.SMTP_FROM,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.subject,
    template: opts.template ?? "generic",
  };

  const tx = getTransporter();
  if (!tx) {
    await EmailLog.create({
      to: opts.to,
      subject: opts.subject,
      template: base.template,
      status: "skipped_no_smtp",
      error: "SMTP_HOST not configured — email was NOT sent",
      entityId: opts.entityId ?? null,
    });
    return { ok: false, skipped: true, reason: "SMTP not configured" };
  }

  try {
    const info = await tx.sendMail(base);
    await EmailLog.create({
      to: opts.to,
      subject: opts.subject,
      template: base.template,
      status: "sent",
      messageId: info.messageId ?? null,
      error: null,
      entityId: opts.entityId ?? null,
    });
    return { ok: true, messageId: info.messageId ?? "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    await EmailLog.create({
      to: opts.to,
      subject: opts.subject,
      template: base.template,
      status: "failed",
      error: msg.slice(0, 500),
      entityId: opts.entityId ?? null,
    });
    return { ok: false, error: msg };
  }
}

export const emailTemplates = {
  welcome: (name: string, verifyUrl?: string) => ({
    subject: `Welcome to FitPro, ${name}`,
    html: layout(
      `Welcome, ${escapeHtml(name)}!`,
      `<p>Your account has been created.</p>${verifyUrl ? `<p><a href="${verifyUrl}">Verify your email</a></p>` : ""}`,
    ),
  }),
  verifyEmail: (name: string, url: string) => ({
    subject: "Verify your email",
    html: layout(`Hi ${escapeHtml(name)}`, `<p><a href="${url}">Click to verify your email</a></p><p>Link expires in 24 hours.</p>`),
  }),
  passwordReset: (name: string, url: string) => ({
    subject: "Reset your password",
    html: layout(`Hi ${escapeHtml(name)}`, `<p><a href="${url}">Reset your password</a></p><p>Link expires in 30 minutes. If you did not request this, ignore this email.</p>`),
  }),
  receipt: (name: string, invoiceNo: string, amount: string) => ({
    subject: `Payment receipt ${invoiceNo}`,
    html: layout(
      `Hi ${escapeHtml(name)}`,
      `<p>We have received your payment of <strong>${escapeHtml(amount)}</strong>.</p><p>Invoice: <strong>${escapeHtml(invoiceNo)}</strong></p><p>You can download the receipt from your member portal.</p>`,
    ),
  }),
  expiryReminder: (name: string, plan: string, expiryDate: string, daysLeft: number) => ({
    subject: daysLeft <= 0 ? "Your membership has expired" : `Your membership expires in ${daysLeft} day(s)`,
    html: layout(
      `Hi ${escapeHtml(name)}`,
      `<p>Your <strong>${escapeHtml(plan)}</strong> membership ${daysLeft <= 0 ? "has expired" : `expires on <strong>${escapeHtml(expiryDate)}</strong> (${daysLeft} day(s) left)`}.</p><p>Please renew at the front desk or from your member portal.</p>`,
    ),
  }),
  membershipActivated: (name: string, plan: string, end: string) => ({
    subject: "Membership activated",
    html: layout(
      `Hi ${escapeHtml(name)}`,
      `<p>Your <strong>${escapeHtml(plan)}</strong> membership is now active until <strong>${escapeHtml(end)}</strong>.</p>`,
    ),
  }),
  classBooked: (name: string, className: string, when: string) => ({
    subject: `Class booking confirmed: ${className}`,
    html: layout(`Hi ${escapeHtml(name)}`, `<p>You are booked for <strong>${escapeHtml(className)}</strong> on ${escapeHtml(when)}.</p>`),
  }),
  enquiryReceived: (name: string) => ({
    subject: "We received your enquiry",
    html: layout(`Hi ${escapeHtml(name)}`, `<p>Thanks for reaching out! Our team will contact you shortly.</p>`),
  }),
};

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e4e4e7">
    <h2 style="margin:0 0 12px;color:#18181b">${title}</h2>
    <div style="color:#3f3f46;line-height:1.6">${body}</div>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"/>
    <p style="color:#71717a;font-size:12px">FitPro Gym Management · This is an automated message.</p>
  </div></body></html>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

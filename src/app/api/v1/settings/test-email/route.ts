import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, ok, badRequest } from "@/lib/api";
import { sendMail } from "@/lib/mailer";
import { usesRealSmtp, env } from "@/lib/env";

const schema = z.object({ to: z.string().email() });

/** Test-email feature for authorized admins. Reports truthfully whether SMTP is configured. */
export const POST = withAuth("settings:update", async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  if (!usesRealSmtp) {
    return ok({
      delivered: false,
      configured: false,
      message: "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in the server environment, then retry.",
    });
  }
  const result = await sendMail({
    to: body.to,
    subject: "FitPro SMTP test",
    html: `<p>This is a test email from <strong>${env.APP_URL}</strong>. If you received it, SMTP is working.</p>`,
    template: "smtp_test",
  });
  if (result.ok) return ok({ delivered: true, configured: true, messageId: result.messageId });
  if ("skipped" in result) return ok({ delivered: false, configured: false, message: result.reason });
  throw badRequest(`SMTP send failed: ${result.error}`);
});

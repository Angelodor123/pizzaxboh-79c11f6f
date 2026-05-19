import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const InviteEmailInput = z.object({
  to: z.string().email().max(254),
  role: z.enum(["admin", "viewer"]),
  appUrl: z.string().url().max(500),
});

function buildRawEmail(to: string, subject: string, html: string) {
  const headers = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
  ].join("\r\n");
  const body = btoa(unescape(encodeURIComponent(html)));
  const raw = headers + "\r\n" + body;
  // base64url
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteEmailInput.parse(input))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY חסר");
    if (!GOOGLE_MAIL_API_KEY) throw new Error("Gmail לא מחובר");

    const roleHe = data.role === "admin" ? "מנהל" : "צופה";
    const subject = `הוזמנת ל-Pizza X — Back of House (${roleHe})`;
    const html = `
      <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #fff; border-radius: 16px;">
        <h1 style="color: #ff1493; margin: 0 0 16px;">🍕 הוזמנת ל-Pizza X BoH</h1>
        <p style="font-size: 16px; line-height: 1.6;">
          קיבלת הרשאת <strong style="color:#ff1493;">${roleHe}</strong> למערכת ניהול המטבח.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          להתחברות, היכנס לקישור הבא והתחבר עם חשבון ה-Google של הכתובת אליה נשלח המייל הזה:
        </p>
        <p style="margin: 24px 0;">
          <a href="${data.appUrl}" style="display: inline-block; background: #ff1493; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            כניסה למערכת
          </a>
        </p>
        <p style="font-size: 12px; color: #888; margin-top: 32px;">
          אם לא ציפית להזמנה זו — אפשר להתעלם מהמייל.
        </p>
      </div>
    `.trim();

    const raw = buildRawEmail(data.to, subject, html);
    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`שליחת מייל נכשלה [${res.status}]: ${body.slice(0, 300)}`);
    }
    return { ok: true };
  });

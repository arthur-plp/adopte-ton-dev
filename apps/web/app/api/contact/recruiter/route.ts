import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { verifySiret } from "@/lib/siret";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  siret: z.string().regex(/^\d{14}$/, "SIRET invalide"),
  jobTitle: z.string().min(1),
  teamSize: z.string().min(1),
  message: z.string().optional(),
});

const ADMIN_EMAIL = "arthur.philippe21@gmail.com";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const data = parsed.data;

  const siretCheck = await verifySiret(data.siret);
  if (!siretCheck.ok) {
    return NextResponse.json({ error: siretCheck.error }, { status: 422 });
  }

  const receivedAt = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL ?? "Adopte Ton Dev <onboarding@resend.dev>";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#4f46e5;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center">
          <p style="margin:0 0 8px;font-size:13px;color:#c7d2fe;letter-spacing:0.08em;text-transform:uppercase">Adopte Ton Dev</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff">Nouvelle demande recruteur</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:36px 40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7">

          <!-- Contact card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f9;border-radius:10px;border:1px solid #e4e4e7;margin-bottom:24px">
            <tr><td style="padding:20px 24px">
              <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#18181b">${data.firstName} ${data.lastName}</p>
              <p style="margin:0 0 12px;font-size:14px;color:#71717a">${data.jobTitle} · ${data.company}</p>
              <a href="mailto:${data.email}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:13px;font-weight:500;padding:8px 16px;border-radius:6px">Répondre à ${data.email}</a>
            </td></tr>
          </table>

          <!-- Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;width:40%;font-size:13px;color:#71717a;font-weight:500">Entreprise</td>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;color:#18181b;font-weight:500">${data.company}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a;font-weight:500">SIRET</td>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;color:#18181b;font-family:monospace;letter-spacing:0.05em">${data.siret}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a;font-weight:500">Taille équipe tech</td>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;color:#18181b">${data.teamSize} personnes</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a;font-weight:500">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;color:#18181b"><a href="mailto:${data.email}" style="color:#4f46e5;text-decoration:none">${data.email}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:#71717a;font-weight:500">Reçu le</td>
              <td style="padding:10px 0;font-size:14px;color:#18181b">${receivedAt}</td>
            </tr>
          </table>

          ${data.message ? `
          <!-- Message -->
          <div style="background:#fafafa;border-left:3px solid #4f46e5;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:8px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.06em">Message</p>
            <p style="margin:0;font-size:14px;color:#18181b;line-height:1.6">${data.message}</p>
          </div>` : ''}

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8f8f9;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#a1a1aa">Adopte Ton Dev · Notification automatique · Ne pas répondre à cet email</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from,
    to: ADMIN_EMAIL,
    subject: `[ATD] Nouvelle demande — ${data.firstName} ${data.lastName} (${data.company})`,
    html,
  });

  return NextResponse.json({ ok: true });
}

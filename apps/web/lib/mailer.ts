import { Resend } from "resend";
import { render } from "@react-email/render";
import { ResetPasswordEmail } from "@/emails/reset-password";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Adopte Ton Dev <onboarding@resend.dev>";

export async function sendResetPasswordEmail({
  to,
  userName,
  resetUrl,
}: {
  to: string;
  userName: string;
  resetUrl: string;
}) {
  const html = await render(
    ResetPasswordEmail({ userName, resetUrl })
  );

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Réinitialise ton mot de passe — Adopte Ton Dev",
    html,
  });
}

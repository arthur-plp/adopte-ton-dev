import { Resend } from "resend";
import { render } from "@react-email/render";
import React from "react";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { RecruiterWelcomeEmail } from "@/emails/recruiter-welcome";
import { VerifyEmail } from "@/emails/verify-email";
import { ContactMessageEmail } from "@/emails/contact-message";

let _resend: Resend | undefined;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Adopte Ton Dev <onboarding@resend.dev>";

const DEV_MODE = process.env.NODE_ENV === "development" && process.env.RESEND_FORCE_SEND !== "true";

async function sendEmail(payload: { from: string; to: string; subject: string; html: string }) {
  if (DEV_MODE) {
    console.log(
      `\n📧 [mailer DEV] Email simulé (non envoyé)\n` +
      `   To:      ${payload.to}\n` +
      `   Subject: ${payload.subject}\n` +
      `   From:    ${payload.from}\n` +
      `   (Définir RESEND_FORCE_SEND=true dans .env.local pour envoyer réellement)\n`,
    );
    return;
  }
  await getResend().emails.send(payload);
}

export async function sendResetPasswordEmail({
  to,
  userName,
  resetUrl,
}: {
  to: string;
  userName: string;
  resetUrl: string;
}) {

  const html = await render(React.createElement(ResetPasswordEmail, { userName, resetUrl }));
  await sendEmail({
    from: FROM,
    to,
    subject: "Réinitialise ton mot de passe — Adopte Ton Dev",
    html,
  });
}

export async function sendVerificationEmail({
  to,
  userName,
  verifyUrl,
}: {
  to: string;
  userName: string;
  verifyUrl: string;
}) {
  const html = await render(React.createElement(VerifyEmail, { userName, verifyUrl }));
  await sendEmail({
    from: FROM,
    to,
    subject: "Confirme ton adresse email — Adopte Ton Dev",
    html,
  });
}

export async function sendRecruiterWelcomeEmail({
  to,
  firstName,
  companyName,
  email,
  temporaryPassword,
  loginUrl,
}: {
  to: string;
  firstName: string;
  companyName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const html = await render(
    React.createElement(RecruiterWelcomeEmail, { firstName, companyName, email, temporaryPassword, loginUrl }),
  );
  await sendEmail({
    from: FROM,
    to,
    subject: `Votre accès recruteur Adopte Ton Dev — ${companyName}`,
    html,
  });
}

const ADMIN_EMAIL = "arthur.philippe21@gmail.com";

export async function sendContactMessageEmail({
  name,
  email,
  subject,
  message,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const html = await render(
    React.createElement(ContactMessageEmail, { name, email, subject, message }),
  );
  await sendEmail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[ATD] Contact — ${subject}`,
    html,
  });
}

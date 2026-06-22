import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendRecruiterWelcomeEmail } from "@/lib/mailer";
import { verifySiret } from "@/lib/siret";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  siret: z.string().regex(/^\d{14}$/, "SIRET invalide (14 chiffres requis)"),
});

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function POST(request: Request) {
  // 1 — Vérifier que le demandeur est ADMIN
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRole = (session.user as { role?: string }).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // 2 — Valider le payload
  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, firstName, lastName, companyName, siret } = parsed.data;

  // 3 — Vérifier le SIRET via l'API Annuaire des Entreprises (data.gouv.fr)
  const siretCheck = await verifySiret(siret);
  if (!siretCheck.ok) {
    return NextResponse.json({ error: siretCheck.error }, { status: 422 });
  }

  // 4 — Créer le compte via BetterAuth admin plugin
  let created: Awaited<ReturnType<typeof auth.api.createUser>> | null = null;
  try {
    created = await auth.api.createUser({
      body: {
        email,
        password,
        name: `${firstName} ${lastName}`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isEmailTaken =
      (msg.toLowerCase().includes("email") && msg.toLowerCase().includes("exist")) ||
      msg.toLowerCase().includes("unique") ||
      msg.toLowerCase().includes("already");
    return NextResponse.json(
      { error: isEmailTaken ? "Un compte existe déjà avec cette adresse email." : `Impossible de créer le compte : ${msg}` },
      { status: 409 },
    );
  }

  if (!created?.user?.id) {
    return NextResponse.json({ error: "Impossible de créer le compte" }, { status: 500 });
  }

  const userId = created.user.id;

  // 5 — Créer le profil recruteur + entreprise via la gateway
  const profileRes = await fetch(`${GATEWAY_URL}/admin/users/${userId}/promote-recruiter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: (await headers()).get("cookie") ?? "",
    },
    body: JSON.stringify({ companyName, companySiret: siret, firstName, lastName }),
  });

  if (!profileRes.ok) {
    const err = (await profileRes.json()) as { message?: string };
    await auth.api.removeUser({ body: { userId } }).catch(() => {});
    return NextResponse.json(
      { error: err.message ?? "Erreur création du profil recruteur" },
      { status: profileRes.status },
    );
  }

  // 6 — Envoyer l'email de bienvenue avec les identifiants
  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  let emailSent = true;
  let emailError: string | null = null;
  await sendRecruiterWelcomeEmail({
    to: email,
    firstName,
    companyName,
    email,
    temporaryPassword: password,
    loginUrl: `${appUrl}/sign-in`,
  }).catch((err: unknown) => {
    emailSent = false;
    emailError = err instanceof Error ? err.message : String(err);
    console.error("[create-recruiter] Email non envoyé :", err);
  });

  return NextResponse.json({ ok: true, userId, emailSent, emailError });
}

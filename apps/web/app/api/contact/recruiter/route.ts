import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  teamSize: z.string().min(1),
  message: z.string().optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const data = parsed.data;

  // En production, on enverra un email via Resend (email-svc).
  // Pour l'instant, log de la demande et retour 200.
  console.log("[Contact recruteur]", {
    name: `${data.firstName} ${data.lastName}`,
    email: data.email,
    company: data.company,
    jobTitle: data.jobTitle,
    teamSize: data.teamSize,
    message: data.message,
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

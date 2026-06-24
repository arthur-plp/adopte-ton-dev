import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactMessageEmail } from "@/lib/mailer";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await sendContactMessageEmail(parsed.data);
  } catch (err: unknown) {
    console.error("[api/contact] Échec d'envoi :", err);
    return NextResponse.json(
      { error: "Échec de l'envoi du message" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession, sendVerificationEmail } from "@/lib/auth-client";

export function EmailVerificationBanner() {
  const { data: session } = useSession();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const user = session?.user as { role?: string; emailVerified?: boolean; email?: string } | undefined;

  if (!user || user.role !== "DEVELOPER" || user.emailVerified) return null;

  async function handleResend() {
    if (!user?.email) return;
    setSending(true);
    await sendVerificationEmail({
      email: user.email,
      callbackURL: "/dashboard/developer",
    });
    setSending(false);
    setSent(true);
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <Mail className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
          Confirme ton adresse email
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
          Tu pourras postuler aux offres une fois ton email vérifié.
        </p>
      </div>
      {sent ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <CheckCircle2 className="size-3.5" />
          Email renvoyé
        </span>
      ) : (
        <Button size="sm" variant="outline" className="shrink-0" disabled={sending} onClick={handleResend}>
          {sending ? "Envoi…" : "Renvoyer l'email"}
        </Button>
      )}
    </div>
  );
}

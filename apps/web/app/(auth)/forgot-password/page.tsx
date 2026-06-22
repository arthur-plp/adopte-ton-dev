"use client";

import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth-client";
import { Code2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type State = "idle" | "loading" | "sent" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    setError("");

    const { error: err } = await requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });

    if (err) {
      setError("Une erreur est survenue. Vérifie ton adresse email et réessaie.");
      setState("error");
    } else {
      toast.success("Email envoyé !", {
        description: `Un lien de réinitialisation a été envoyé à ${email.trim()}. Pense à vérifier tes spams.`,
        duration: 6000,
      });
      setState("sent");
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,oklch(0.85_0.08_264/25%),transparent)]"
      />

      <Link
        href="/sign-in"
        className="absolute left-4 top-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="size-4" />
        Retour
      </Link>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Code2 className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Adopte Ton Dev
          </h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {state === "sent" ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Email envoyé !
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Si un compte existe pour{" "}
                  <span className="font-medium text-foreground">{email}</span>,
                  tu vas recevoir un lien de réinitialisation dans quelques
                  secondes. Pense à vérifier tes spams.
                </p>
              </div>
              <Link
                href="/sign-in"
                className="mt-2 text-sm text-primary hover:underline"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground">
                  Mot de passe oublié
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Saisis ton adresse email et on t&apos;envoie un lien pour
                  réinitialiser ton mot de passe.
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-foreground"
                  >
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="toi@example.com"
                      className="input-base w-full pl-9"
                    />
                  </div>
                </div>

                {state === "error" && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={state === "loading" || !email.trim()}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
                >
                  {state === "loading"
                    ? "Envoi en cours…"
                    : "Envoyer le lien de réinitialisation"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Tu te souviens de ton mot de passe ?{" "}
                <Link href="/sign-in" className="text-primary hover:underline">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

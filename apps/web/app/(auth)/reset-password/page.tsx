"use client";

import Link from "next/link";
import { resetPassword } from "@/lib/auth-client";
import { Code2, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type State = "idle" | "loading" | "success" | "error";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const passwordsMatch = password === confirm;
  const isValid = password.length >= 8 && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !token) return;

    setState("loading");
    setError("");

    const { error: err } = await resetPassword({
      newPassword: password,
      token,
    });

    if (err) {
      setError(
        "Le lien est invalide ou expiré. Refais une demande de réinitialisation."
      );
      setState("error");
    } else {
      setState("success");
      setTimeout(() => router.push("/sign-in"), 3000);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="size-12 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">
            Lien invalide
          </h1>
          <p className="text-sm text-muted-foreground">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Faire une nouvelle demande
          </Link>
        </div>
      </div>
    );
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
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Code2 className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Adopte Ton Dev
          </h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {state === "success" ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Mot de passe mis à jour !
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ton mot de passe a été réinitialisé avec succès. Tu vas être
                  redirigé vers la page de connexion…
                </p>
              </div>
              <Link href="/sign-in" className="text-sm text-primary hover:underline">
                Se connecter maintenant
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground">
                  Nouveau mot de passe
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Choisis un mot de passe d&apos;au moins 8 caractères.
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoFocus
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 caractères minimum"
                      className="input-base w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirm"
                    className="text-sm font-medium text-foreground"
                  >
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Répète ton mot de passe"
                    className={`input-base w-full ${
                      confirm && !passwordsMatch
                        ? "border-destructive focus:ring-destructive"
                        : ""
                    }`}
                  />
                  {confirm && !passwordsMatch && (
                    <p className="text-xs text-destructive">
                      Les mots de passe ne correspondent pas.
                    </p>
                  )}
                </div>

                {state === "error" && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state === "loading" || !isValid}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
                >
                  {state === "loading"
                    ? "Mise à jour…"
                    : "Réinitialiser mon mot de passe"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

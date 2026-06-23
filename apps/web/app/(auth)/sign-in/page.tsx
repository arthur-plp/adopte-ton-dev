"use client";

import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Code2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type OAuthProvider = "github" | "google";
type Mode = "signin" | "signup";

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    params.get("tab") === "signup" ? "signup" : "signin"
  );

  const rawAuthError = params.get("authError");
  const authErrorMsg = rawAuthError
    ? (AUTH_ERRORS[rawAuthError] ?? "Une erreur est survenue lors de la connexion. Réessaie.")
    : null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,oklch(0.85_0.08_264/25%),transparent)]"
      />

      <Link
        href="/"
        className="absolute left-4 top-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="size-4" />
        Retour
      </Link>

      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Code2 className="size-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold">Adopte Ton Dev</span>
      </Link>

      {authErrorMsg && (
        <div className="mb-4 w-full max-w-sm rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {authErrorMsg}
        </div>
      )}

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        {/* Onglets Connexion / Inscription */}
        <div className="mb-6 flex rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={[
              "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
              mode === "signin"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={[
              "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
              mode === "signup"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            S&apos;inscrire
          </button>
        </div>

        {/* Boutons OAuth */}
        <OAuthButtons />

        {/* Séparateur */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Formulaire email / mot de passe */}
        {mode === "signin" ? (
          <SignInForm onSuccess={() => {
            toast.success("Connexion réussie !", { description: "Bienvenue sur Adopte Ton Dev." });
            router.push("/dashboard");
          }} />
        ) : (
          <SignUpForm onSuccess={() => {
            toast.success("Compte créé !", { description: "Bienvenue sur Adopte Ton Dev." });
            router.push("/dashboard");
          }} />
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        En continuant, tu acceptes nos{" "}
        <Link href="/cgu" className="underline underline-offset-2 hover:text-foreground">
          conditions d&apos;utilisation
        </Link>{" "}
        et notre{" "}
        <Link href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  );
}

// ── Traduction des erreurs BetterAuth ─────────────────────────────────────────

const AUTH_ERRORS: Record<string, string> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Un compte existe déjà avec cette adresse email.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cette adresse email.",
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  INVALID_PASSWORD: "Mot de passe incorrect.",
  USER_NOT_FOUND: "Aucun compte trouvé avec cet email.",
  ACCOUNT_NOT_FOUND: "Aucun compte trouvé.",
  EMAIL_NOT_VERIFIED: "Votre email n'a pas encore été vérifié.",
  SESSION_EXPIRED: "Session expirée. Reconnecte-toi.",
  TOO_MANY_REQUESTS: "Trop de tentatives. Réessaie dans quelques instants.",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "Ce compte social est déjà associé à un autre utilisateur.",
  FAILED_TO_GET_USER_INFO: "Impossible de récupérer les informations du compte.",
  PROVIDER_NOT_FOUND: "Fournisseur d'authentification introuvable.",
  // Erreurs OAuth renvoyées via ?authError=
  "email_doesn't_match": "Un compte existe déjà avec cet email via un autre fournisseur (GitHub ou Google). Connecte-toi avec le bon fournisseur.",
  "email_doesn_t_match": "Un compte existe déjà avec cet email via un autre fournisseur. Connecte-toi avec le bon fournisseur.",
  oauth_account_not_linked: "Ce compte social n'est pas encore associé. Connecte-toi d'abord avec ton fournisseur habituel.",
};

function translateAuthError(error: { code?: string | null; message?: string | null } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.code && AUTH_ERRORS[error.code]) return AUTH_ERRORS[error.code]!;
  return fallback;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

function OAuthButtons() {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    setLoading(provider);
    localStorage.setItem("showWelcome", "1");
    await signIn.social({ provider, callbackURL: "/dashboard" });
    setLoading(null);
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="h-10 w-full gap-3 text-sm"
        disabled={loading !== null}
        onClick={() => handleOAuth("github")}
      >
        {loading === "github" ? <Spinner /> : <GithubIcon />}
        {loading === "github" ? "Connexion…" : "Continuer avec GitHub"}
      </Button>
      <Button
        variant="outline"
        className="h-10 w-full gap-3 text-sm"
        disabled={loading !== null}
        onClick={() => handleOAuth("google")}
      >
        {loading === "google" ? <Spinner /> : <GoogleIcon />}
        {loading === "google" ? "Connexion…" : "Continuer avec Google"}
      </Button>
    </div>
  );
}

// ── Formulaire connexion ───────────────────────────────────────────────────────

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);

    const result = await signIn.email({ email, password });

    if (result.error) {
      setError(translateAuthError(result.error, "Email ou mot de passe incorrect."));
      setLoading(false);
      submitting.current = false;
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Adresse email">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
          className="input-base"
        />
      </Field>

      <Field label="Mot de passe">
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-base pr-10"
          />
          <ToggleEye show={showPwd} onToggle={() => setShowPwd((v) => !v)} />
        </div>
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Button type="submit" className="h-10 w-full" disabled={loading}>
        {loading ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

// ── Formulaire inscription ─────────────────────────────────────────────────────

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Prénom et nom sont requis.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    submitting.current = true;
    setLoading(true);
    const name = `${firstName.trim()} ${lastName.trim()}`;
    const result = await signUp.email({ name, email, password });

    if (result.error) {
      setError(translateAuthError(result.error, "Erreur lors de la création du compte."));
      setLoading(false);
      submitting.current = false;
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <input
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Alex"
            className="input-base"
          />
        </Field>
        <Field label="Nom">
          <input
            type="text"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Dupont"
            className="input-base"
          />
        </Field>
      </div>

      <Field label="Adresse email">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
          className="input-base"
        />
      </Field>

      <Field label="Mot de passe">
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            className="input-base pr-10"
          />
          <ToggleEye show={showPwd} onToggle={() => setShowPwd((v) => !v)} />
        </div>
        <PasswordStrength password={password} />
      </Field>

      <Field label="Confirmer le mot de passe">
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className={[
              "input-base pr-10",
              confirm && confirm !== password
                ? "border-destructive focus:ring-destructive/30"
                : "",
            ].join(" ")}
          />
          <ToggleEye show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
        </div>
        {confirm && confirm !== password && (
          <p className="mt-1 text-xs text-destructive">
            Les mots de passe ne correspondent pas.
          </p>
        )}
      </Field>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Button type="submit" className="h-10 w-full" disabled={loading}>
        {loading ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}

// ── Composants partagés ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function ToggleEye({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
    >
      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      {children}
    </p>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const len = password.length;
  const strength = len < 8 ? 0 : len < 12 ? 1 : len < 16 ? 2 : 3;
  const labels = ["Trop court", "Faible", "Correct", "Fort"];
  const colors = ["bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-green-500"];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              "h-1 flex-1 rounded-full transition-colors",
              i <= strength ? colors[strength] : "bg-muted",
            ].join(" ")}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[strength]}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

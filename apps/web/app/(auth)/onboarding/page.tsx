"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Code2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/users/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: "DEVELOPER" }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Erreur lors de l'onboarding");
      }

      router.replace("/dashboard/developer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    router.replace("/sign-in");
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,oklch(0.85_0.08_264/25%),transparent)]"
      />

      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Code2 className="size-4 text-primary-foreground" />
        </div>
        <span className="text-base font-semibold">Adopte Ton Dev</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Code2 className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Bienvenue, {session.user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tu rejoins la plateforme en tant que <strong>développeur junior</strong>.
            Crée ton profil et laisse tes compétences parler pour toi.
          </p>
        </div>

        {/* Ce qui t'attend */}
        <ul className="mb-8 space-y-3">
          {[
            "Profil centré sur tes compétences et projets",
            "Import automatique de tes repos GitHub",
            "Alertes dès qu'une offre correspond à ta stack",
            "Messagerie directe avec les recruteurs",
            "100 % gratuit pour les développeurs",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-foreground/80">
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          className="h-10 w-full"
          disabled={loading}
          onClick={handleConfirm}
        >
          {loading ? (
            "Création du profil…"
          ) : (
            <>
              Commencer mon profil <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Tu es recruteur ?{" "}
          <Link href="/recruteurs" className="text-primary hover:underline">
            Contacte-nous pour obtenir un accès
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Check, X, Zap, ArrowLeft } from "lucide-react";

const FREE_FEATURES = [
  { label: "2 offres actives simultanément", ok: true },
  { label: "Offres illimitées (brouillons)", ok: true },
  { label: "Tableau de bord recruteur", ok: true },
  { label: "Profil entreprise", ok: true },
  { label: "Offres illimitées publiées", ok: false },
  { label: "Recherche avancée de profils", ok: false },
  { label: "Contact direct illimité", ok: false },
  { label: "Mise en avant des offres", ok: false },
  { label: "Support prioritaire", ok: false },
];

const PRO_FEATURES = [
  { label: "Offres publiées illimitées", ok: true },
  { label: "Brouillons illimités", ok: true },
  { label: "Tableau de bord recruteur", ok: true },
  { label: "Profil entreprise", ok: true },
  { label: "Recherche avancée de profils", ok: true },
  { label: "Contact direct illimité", ok: true },
  { label: "Mise en avant des offres", ok: true },
  { label: "Support prioritaire", ok: true },
  { label: "Statistiques avancées", ok: true },
];

export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansContent />
    </Suspense>
  );
}

function PlansContent() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const { data: session } = useSession();
  const isRecruiter = (session?.user as { role?: string } | null)?.role === "RECRUITER";
  const searchParams = useSearchParams();

  const [plan, setPlan] = useState<"FREE" | "PRO" | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (!isRecruiter) return;
    fetch(`${apiUrl}/payment/subscription`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<{ plan: "FREE" | "PRO" }>) : null))
      .then((data) => {
        if (data) setPlan(data.plan);
      })
      .catch(() => setPlan("FREE"));
  }, [isRecruiter, apiUrl]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Bienvenue dans le plan Pro !");
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Paiement annulé — tu peux réessayer à tout moment.");
    }
    // Affiché une seule fois au montage, sur la base des query params de redirection Stripe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade() {
    setLoadingAction(true);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${apiUrl}/payment/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          successUrl: `${origin}/plans?success=true`,
          cancelUrl: `${origin}/plans?canceled=true`,
        }),
      });
      if (!res.ok) {
        toast.error("Impossible de démarrer le paiement.");
        return;
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleManageBilling() {
    setLoadingAction(true);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${apiUrl}/payment/billing-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ returnUrl: `${origin}/dashboard/recruiter` }),
      });
      if (!res.ok) {
        toast.error("Impossible d'ouvrir le portail de facturation.");
        return;
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        {isRecruiter && (
          <div className="mb-8">
            <Link
              href="/dashboard/recruiter"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Retour au tableau de bord
            </Link>
          </div>
        )}

        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-foreground">Choisissez votre plan</h1>
          <p className="mt-3 text-muted-foreground">
            Démarrez gratuitement, passez à Pro quand votre activité le demande.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Plan Free */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <div className="mb-6">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Gratuit</p>
              <p className="mt-1 text-4xl font-bold text-foreground">0 €</p>
              <p className="mt-1 text-sm text-muted-foreground">Pour découvrir la plateforme</p>
            </div>

            <ul className="mb-8 space-y-3">
              {FREE_FEATURES.map(({ label, ok }) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  {ok ? (
                    <Check className="size-4 shrink-0 text-green-500" />
                  ) : (
                    <X className="size-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={ok ? "text-foreground" : "text-muted-foreground/60"}>{label}</span>
                </li>
              ))}
            </ul>

            <Button variant="outline" className="w-full" disabled>
              {isRecruiter && plan === "PRO" ? "Inclus dans votre abonnement" : "Plan actuel"}
            </Button>
          </div>

          {/* Plan Pro */}
          <div className="relative rounded-2xl border-2 border-primary bg-card p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                <Zap className="size-3" />
                Recommandé
              </span>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium uppercase tracking-wide text-primary">Pro</p>
              <div className="mt-1 flex items-end gap-2">
                <p className="text-4xl font-bold text-foreground">49 €</p>
                <p className="mb-1 text-sm text-muted-foreground">/mois</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Pour les équipes qui recrutent activement</p>
            </div>

            <ul className="mb-8 space-y-3">
              {PRO_FEATURES.map(({ label, ok }) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <Check className={`size-4 shrink-0 ${ok ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className="text-foreground">{label}</span>
                </li>
              ))}
            </ul>

            {isRecruiter && plan === "PRO" ? (
              <Button className="w-full gap-2" onClick={handleManageBilling} disabled={loadingAction}>
                <Zap className="size-4" />
                Gérer mon abonnement
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={handleUpgrade}
                disabled={!isRecruiter || loadingAction}
              >
                <Zap className="size-4" />
                {isRecruiter ? "Passer au Pro" : "Réservé aux recruteurs"}
              </Button>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Paiement sécurisé par Stripe · Résiliable à tout moment
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-border bg-muted/30 px-6 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Pour les développeurs juniors</strong>, la plateforme est et restera{" "}
            <strong className="text-foreground">100 % gratuite</strong>. Notre mission : faciliter votre insertion professionnelle.
          </p>
        </div>
      </main>
    </div>
  );
}

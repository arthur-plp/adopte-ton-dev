"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MapPin,
  Wifi,
  Calendar,
  ArrowRight,
  Briefcase,
  Building2,
  Send,
} from "lucide-react";

type JobOffer = {
  id: string;
  title: string;
  description: string;
  type: "INTERNSHIP" | "APPRENTICESHIP" | "FIRST_JOB";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  location: string | null;
  remoteOk: boolean;
  requiredTechnologies: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: string;
  companyId: string;
  companyName: string | null;
  requiredTechLevels: Record<string, string> | null;
};

const TYPE_LABELS: Record<JobOffer["type"], string> = {
  INTERNSHIP: "Stage",
  APPRENTICESHIP: "Alternance",
  FIRST_JOB: "Premier emploi",
};

const TYPE_COLORS: Record<JobOffer["type"], string> = {
  INTERNSHIP: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  APPRENTICESHIP: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  FIRST_JOB: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const isDeveloper = (session?.user as { role?: string } | undefined)?.role === "DEVELOPER";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/job-offers/${id}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); return null; }
        return res.json() as Promise<JobOffer>;
      })
      .then((data) => { if (data) setOffer(data); })
      .finally(() => setLoading(false));
  }, [id, apiUrl]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (notFound || !offer) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <Briefcase className="size-12 text-muted-foreground/40" />
          <h1 className="text-xl font-bold text-foreground">Offre introuvable</h1>
          <p className="text-sm text-muted-foreground">Cette offre n&apos;existe pas ou a été supprimée.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/offres">
              <ArrowLeft className="size-4" /> Retour aux offres
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const publishedAt = new Date(offer.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          {/* Back */}
          <Link
            href="/offres"
            className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour aux offres
          </Link>

          {/* Header */}
          <div className="mb-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[offer.type]}`}>
                {TYPE_LABELS[offer.type]}
              </span>
              {offer.remoteOk && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wifi className="size-3" /> Remote possible
                </span>
              )}
            </div>

            <h1 className="mb-2 text-2xl font-bold text-foreground">{offer.title}</h1>

            {offer.companyName && (
              <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                {offer.companyName}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {offer.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" /> {offer.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4" /> Publiée le {publishedAt}
              </span>
              {(offer.salaryMin || offer.salaryMax) && (
                <span>
                  {offer.salaryMin && offer.salaryMax
                    ? `${offer.salaryMin}–${offer.salaryMax} €/mois`
                    : offer.salaryMin
                    ? `Dès ${offer.salaryMin} €/mois`
                    : `Jusqu'à ${offer.salaryMax} €/mois`}
                </span>
              )}
            </div>
          </div>

          {/* Technologies */}
          {offer.requiredTechnologies.length > 0 && (
            <div className="card mb-6 p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Technologies recherchées</h2>
              <div className="flex flex-wrap gap-2">
                {offer.requiredTechnologies.map((tech) => {
                  const level = offer.requiredTechLevels?.[tech];
                  const levelConfig = level === "BEGINNER"
                    ? { label: "Débutant", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" }
                    : level === "INTERMEDIATE"
                    ? { label: "Intermédiaire", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
                    : level === "ADVANCED"
                    ? { label: "Avancé", cls: "bg-violet-500/10 text-violet-700 dark:text-violet-400" }
                    : null;
                  return (
                    <div key={tech} className="flex items-center gap-1.5">
                      <span className="badge px-2.5 py-1 text-xs">{tech}</span>
                      {levelConfig && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${levelConfig.cls}`}>
                          {levelConfig.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="card mb-8 p-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Description du poste</h2>
            <div className="prose prose-sm max-w-none text-foreground/80">
              {offer.description.split("\n").map((line, i) => (
                <p key={i} className={`text-sm leading-relaxed ${!line.trim() ? "mt-2" : ""}`}>
                  {line || " "}
                </p>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="card p-6">
            {isDeveloper ? (
              <>
                <h2 className="mb-1 font-semibold text-foreground">Postuler à cette offre</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Envoyez votre candidature et mettez en avant votre profil et vos projets.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button disabled title="Candidatures disponibles prochainement">
                    <Send className="size-4" />
                    Candidater
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/offres">Voir d&apos;autres offres</Link>
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Les candidatures seront disponibles très prochainement.</p>
              </>
            ) : (
              <>
                <h2 className="mb-1 font-semibold text-foreground">Intéressé(e) par ce poste ?</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Connectez-vous pour postuler et mettre en avant votre profil auprès du recruteur.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/sign-in">
                      Se connecter pour postuler <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/offres">Voir d&apos;autres offres</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

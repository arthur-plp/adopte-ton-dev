"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Wifi, Briefcase, ArrowRight, X } from "lucide-react";

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

type PaginatedOffers = {
  data: JobOffer[];
  total: number;
  page: number;
  pageSize: number;
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

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
};

const LEVEL_DOT_COUNT: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

const LEVEL_DOT_COLOR: Record<string, string> = {
  BEGINNER: "bg-sky-500",
  INTERMEDIATE: "bg-emerald-500",
  ADVANCED: "bg-violet-500",
};

const PAGE_SIZE = 12;

export default function OffresPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [result, setResult] = useState<PaginatedOffers | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [searchTech, setSearchTech] = useState("");
  const [filterType, setFilterType] = useState<JobOffer["type"] | "">("");
  const [filterRemote, setFilterRemote] = useState(false);
  const [filterLocation, setFilterLocation] = useState("");

  const fetchOffers = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p.toString(), pageSize: PAGE_SIZE.toString() });
    if (filterType) params.set("type", filterType);
    if (filterRemote) params.set("remoteOk", "true");
    if (filterLocation.trim()) params.set("location", filterLocation.trim());
    if (searchTech.trim()) params.append("technologies", searchTech.trim());

    try {
      const res = await fetch(`${apiUrl}/job-offers?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as PaginatedOffers;
        setResult(data);
      } else {
        toast.error("Impossible de charger les offres. Réessaie.");
      }
    } catch {
      toast.error("Impossible de charger les offres. Réessaie.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, filterType, filterRemote, filterLocation, searchTech]);

  useEffect(() => {
    setPage(1);
    void fetchOffers(1);
  }, [filterType, filterRemote, filterLocation, searchTech, fetchOffers]);

  useEffect(() => {
    void fetchOffers(page);
  }, [page, fetchOffers]);

  function clearFilters() {
    setFilterType("");
    setFilterRemote(false);
    setFilterLocation("");
    setSearchTech("");
  }

  const hasFilters = filterType !== "" || filterRemote || filterLocation !== "" || searchTech !== "";
  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-muted/30 px-4 py-12 text-center">
          <h1 className="mb-3 text-3xl font-bold text-foreground">Offres pour développeurs juniors</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Stages, alternances et premiers emplois sélectionnés — recruteurs qui valorisent vos compétences, pas uniquement votre expérience.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* Filtres */}
          <div className="mb-6 flex flex-wrap items-end gap-3">
            {/* Recherche par techno */}
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-base pl-9"
                value={searchTech}
                onChange={(e) => setSearchTech(e.target.value)}
                placeholder="TypeScript, React, Node…"
              />
            </div>

            {/* Localisation */}
            <div className="min-w-36">
              <CityAutocomplete
                city={filterLocation}
                country=""
                onChange={(city) => setFilterLocation(city)}
                placeholder="Ville…"
              />
            </div>

            {/* Type de contrat */}
            <select
              className="input-base w-auto min-w-40"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as JobOffer["type"] | "")}
            >
              <option value="">Tous les contrats</option>
              <option value="INTERNSHIP">Stage</option>
              <option value="APPRENTICESHIP">Alternance</option>
              <option value="FIRST_JOB">Premier emploi</option>
            </select>

            {/* Remote */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={filterRemote}
                onChange={(e) => setFilterRemote(e.target.checked)}
              />
              <Wifi className="size-4 text-muted-foreground" />
              Remote
            </label>

            {/* Clear */}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="size-3.5" />
                Effacer
              </Button>
            )}
          </div>

          {/* Résultats */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !result || result.data.length === 0 ? (
            <div className="empty-state py-16">
              <Briefcase className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Aucune offre trouvée</p>
              <p className="mt-1 text-xs text-muted-foreground">Essayez d&apos;élargir vos critères de recherche.</p>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                  Effacer les filtres
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {result.total} offre{result.total > 1 ? "s" : ""}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.data.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Précédent
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

function OfferCard({ offer }: { offer: JobOffer }) {
  const preview = offer.description.slice(0, 120).trim();
  const hasMore = offer.description.length > 120;

  return (
    <Link
      href={`/offres/${offer.id}`}
      className="card flex flex-col p-5 transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[offer.type]}`}>
          {TYPE_LABELS[offer.type]}
        </span>
        {offer.remoteOk && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wifi className="size-3" /> Remote
          </span>
        )}
      </div>

      <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-foreground">{offer.title}</h3>

      {offer.companyName && (
        <p className="mb-1 text-xs font-medium text-foreground/70">{offer.companyName}</p>
      )}

      {offer.location && (
        <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" /> {offer.location}
        </p>
      )}

      <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
        {preview}{hasMore ? "…" : ""}
      </p>

      {offer.requiredTechnologies.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {offer.requiredTechnologies.slice(0, 4).map((tech) => {
            const level = offer.requiredTechLevels?.[tech];
            return (
              <span
                key={tech}
                className="badge flex items-center gap-1.5"
                title={level ? `Niveau souhaité : ${LEVEL_LABELS[level]}` : undefined}
              >
                {tech}
                {level && (
                  <span className="flex items-center gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`size-1.5 rounded-full ${
                          i < (LEVEL_DOT_COUNT[level] ?? 0) ? LEVEL_DOT_COLOR[level] : "bg-muted-foreground/20"
                        }`}
                      />
                    ))}
                  </span>
                )}
              </span>
            );
          })}
          {offer.requiredTechnologies.length > 4 && (
            <span className="badge">+{offer.requiredTechnologies.length - 4}</span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-2">
        {offer.salaryMin || offer.salaryMax ? (
          <span className="text-xs text-muted-foreground">
            {offer.salaryMin && offer.salaryMax
              ? `${offer.salaryMin}–${offer.salaryMax} €/mois`
              : offer.salaryMin
              ? `Dès ${offer.salaryMin} €/mois`
              : `Jusqu'à ${offer.salaryMax} €/mois`}
          </span>
        ) : (
          <span />
        )}
        <ArrowRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

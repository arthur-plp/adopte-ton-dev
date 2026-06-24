"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, MapPin, Wifi, X } from "lucide-react";
import { DeveloperTechnologiesFilter, type TechLevel } from "./developer-technologies-filter";

type DeveloperResult = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  location: string | null;
  remoteOk: boolean;
  technologies: { name: string; level: TechLevel }[];
  score: number | null;
};

type PaginatedDevelopers = {
  data: DeveloperResult[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 12;

export default function DeveloppeurPage() {
  const { data: session, isPending } = useSession();
  const role = (session?.user as { role?: string } | null)?.role;
  const isAllowed = role === "RECRUITER" || role === "ADMIN";

  if (isPending) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAllowed) return <RestrictedNotice />;

  return <DeveloperSearch />;
}

function RestrictedNotice() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Users className="size-8 text-primary" />
        </div>
        <h1 className="mb-3 text-3xl font-bold text-foreground">Réservé aux recruteurs</h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          La recherche de profils développeurs est accessible aux comptes recruteurs. Demandez votre accès pour explorer l&apos;annuaire des candidats.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/recruteurs">
              Accès recruteur <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function DeveloperSearch() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [result, setResult] = useState<PaginatedDevelopers | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [techLevels, setTechLevels] = useState<Record<string, TechLevel>>({});
  const [filterRemote, setFilterRemote] = useState(false);
  const [filterLocation, setFilterLocation] = useState("");

  const fetchDevelopers = useCallback(
    async (p: number) => {
      setLoading(true);
      const params = new URLSearchParams({ page: p.toString(), pageSize: PAGE_SIZE.toString() });
      selectedTechs.forEach((t) => params.append("technologies", t));
      if (Object.keys(techLevels).length > 0) params.set("levels", JSON.stringify(techLevels));
      if (filterRemote) params.set("remoteOk", "true");
      if (filterLocation.trim()) params.set("location", filterLocation.trim());

      try {
        const res = await fetch(`${apiUrl}/matching/developers?${params.toString()}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as PaginatedDevelopers;
          setResult(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, selectedTechs, techLevels, filterRemote, filterLocation],
  );

  useEffect(() => {
    setPage(1);
    void fetchDevelopers(1);
  }, [selectedTechs, techLevels, filterRemote, filterLocation, fetchDevelopers]);

  useEffect(() => {
    void fetchDevelopers(page);
  }, [page, fetchDevelopers]);

  function clearFilters() {
    setSelectedTechs([]);
    setTechLevels({});
    setFilterRemote(false);
    setFilterLocation("");
  }

  const hasFilters = selectedTechs.length > 0 || filterRemote || filterLocation !== "";
  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 px-4 py-12 text-center">
          <h1 className="mb-3 text-3xl font-bold text-foreground">Profils développeurs</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Recherchez des candidats par technologies et niveau souhaité — score de compatibilité calculé en direct.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Filtres */}
            <div className="card space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Localisation</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="input-base pl-9"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="Ville…"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={filterRemote}
                  onChange={(e) => setFilterRemote(e.target.checked)}
                />
                <Wifi className="size-4 text-muted-foreground" />
                Remote uniquement
              </label>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Technologies souhaitées</label>
                <DeveloperTechnologiesFilter
                  selected={selectedTechs}
                  levels={techLevels}
                  onChange={(techs, levels) => {
                    setSelectedTechs(techs);
                    setTechLevels(levels);
                  }}
                />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-muted-foreground">
                  <X className="size-3.5" />
                  Effacer les filtres
                </Button>
              )}
            </div>

            {/* Résultats */}
            <div>
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : !result || result.data.length === 0 ? (
                <div className="empty-state py-16">
                  <Users className="mb-3 size-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">Aucun profil trouvé</p>
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
                    {result.total} profil{result.total > 1 ? "s" : ""}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {result.data.map((dev) => (
                      <DeveloperCard key={dev.id} dev={dev} />
                    ))}
                  </div>

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
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function DeveloperCard({ dev }: { dev: DeveloperResult }) {
  return (
    <Link
      href={`/developpeurs/${dev.userId}`}
      className="card flex flex-col p-5 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {dev.firstName} {dev.lastName}
        </h3>
        {dev.score !== null && (
          <span className="badge shrink-0 text-primary">{dev.score}% compatible</span>
        )}
      </div>

      {dev.title && <p className="mb-1 text-xs font-medium text-foreground/70">{dev.title}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {dev.location && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" /> {dev.location}
          </span>
        )}
        {dev.remoteOk && (
          <span className="flex items-center gap-1">
            <Wifi className="size-3" /> Remote possible
          </span>
        )}
      </div>

      {dev.technologies.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {dev.technologies.slice(0, 4).map((tech) => (
            <span key={tech.name} className="badge">
              {tech.name}
            </span>
          ))}
          {dev.technologies.length > 4 && (
            <span className="badge">+{dev.technologies.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  );
}

"use client";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Code2,
  Briefcase,
  Bell,
  ArrowRight,
  GitBranch,
  Star,
  Plus,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Building2,
  MapPin,
  Wifi,
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/components/application-event-timeline";

type Project = {
  id: string;
  title: string;
  description: string;
  repoUrl: string | null;
  technologies: string[];
  githubStars: number | null;
  githubPushedAt: string | null;
  visible: boolean;
};

type DevProfile = {
  id: string;
  title: string | null;
  bio: string | null;
  location: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  technologies: { id: string; name: string }[];
  skills: { id: string }[];
  projects: Project[];
};

type CompletionStep = {
  key: string;
  label: string;
  done: boolean;
};

type Application = {
  id: string;
  jobOfferId: string;
  status: ApplicationStatus;
  createdAt: string;
};

type JobOfferSummary = {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  remoteOk: boolean;
};

type RecommendedOffer = JobOfferSummary & {
  requiredTechnologies: string[];
  score: number;
};

function getCompletionSteps(profile: DevProfile): CompletionStep[] {
  return [
    { key: "title", label: "Titre professionnel", done: !!profile.title },
    { key: "bio", label: "Bio", done: !!profile.bio },
    { key: "location", label: "Localisation", done: !!profile.location },
    { key: "technologies", label: "3 technologies min.", done: profile.technologies.length >= 3 },
    { key: "skills", label: "1 compétence", done: profile.skills.length >= 1 },
    { key: "projects", label: "1 projet visible", done: profile.projects.some((p) => p.visible) },
    { key: "links", label: "Lien GitHub / portfolio", done: !!(profile.githubUrl || profile.portfolioUrl) },
  ];
}

export default function DeveloperDashboard() {
  const { data: session } = useSession();
  const firstName = session?.user.name.split(" ")[0] ?? "Développeur";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [profile, setProfile] = useState<DevProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationOffers, setApplicationOffers] = useState<Record<string, JobOfferSummary>>({});
  const [pendingDocsByApplication, setPendingDocsByApplication] = useState<Record<string, number>>({});
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [recommendedOffers, setRecommendedOffers] = useState<RecommendedOffer[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [appliedOfferIds, setAppliedOfferIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${apiUrl}/users/me/profile`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { role?: string; profile?: DevProfile };
        if (d?.role === "DEVELOPER" && d.profile) setProfile(d.profile);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [apiUrl]);

  useEffect(() => {
    if (profileLoading) return;
    const techNames = profile?.technologies.map((t) => t.name) ?? [];
    if (techNames.length === 0) {
      setRecommendedLoading(false);
      return;
    }

    const params = new URLSearchParams({ page: "1", pageSize: "20" });
    techNames.forEach((name) => params.append("technologies", name));

    fetch(`${apiUrl}/job-offers?${params.toString()}`)
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{
              data: (JobOfferSummary & { requiredTechnologies: string[] })[];
            }>)
          : { data: [] },
      )
      .then(({ data }) => {
        const scored = data
          .map((offer) => {
            const matched = offer.requiredTechnologies.filter((t) =>
              techNames.includes(t),
            ).length;
            const score =
              offer.requiredTechnologies.length > 0
                ? Math.round((matched / offer.requiredTechnologies.length) * 100)
                : 0;
            return { ...offer, score };
          })
          .filter((offer) => offer.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6);
        setRecommendedOffers(scored);
      })
      .catch(() => setRecommendedOffers([]))
      .finally(() => setRecommendedLoading(false));
  }, [profileLoading, profile, apiUrl]);

  useEffect(() => {
    fetch(`${apiUrl}/applications/mine`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<Application[]>) : []))
      .then(async (apps) => {
        setAppliedOfferIds(new Set(apps.map((a) => a.jobOfferId)));

        const recent = [...apps]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setApplications(recent);

        const uniqueOfferIds = Array.from(new Set(recent.map((a) => a.jobOfferId)));
        const fetched = await Promise.all(
          uniqueOfferIds.map((id) =>
            fetch(`${apiUrl}/job-offers/${id}`)
              .then((r) => (r.ok ? (r.json() as Promise<JobOfferSummary>) : null))
              .catch(() => null),
          ),
        );
        const map: Record<string, JobOfferSummary> = {};
        uniqueOfferIds.forEach((id, i) => {
          const offer = fetched[i];
          if (offer) map[id] = offer;
        });
        setApplicationOffers(map);

        const pendingCounts = await Promise.all(
          recent.map((a) =>
            fetch(`${apiUrl}/applications/${a.id}/document-requests`, {
              credentials: "include",
            })
              .then((r) =>
                r.ok ? (r.json() as Promise<{ status: string }[]>) : [],
              )
              .then((requests) => requests.filter((r) => r.status === "PENDING").length)
              .catch(() => 0),
          ),
        );
        const docsMap: Record<string, number> = {};
        recent.forEach((a, i) => {
          docsMap[a.id] = pendingCounts[i] ?? 0;
        });
        setPendingDocsByApplication(docsMap);
      })
      .catch(() => setApplications([]))
      .finally(() => setApplicationsLoading(false));
  }, [apiUrl]);

  const visibleProjects = profile?.projects.filter((p) => p.visible) ?? [];
  const completionSteps = profile ? getCompletionSteps(profile) : [];
  const doneCount = completionSteps.filter((s) => s.done).length;
  const totalCount = completionSteps.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const isComplete = !!profile && doneCount === totalCount;
  const missingSteps = completionSteps.filter((s) => !s.done);

  return (
    <div className="page-container">
      <EmailVerificationBanner />

      {/* ── Welcome ──────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-foreground">
          Bonjour, {firstName} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Voici un aperçu de ton activité sur Adopte Ton Dev.
        </p>
      </div>

      {/* ── Profil completion banner ─────────────────────────────── */}
      {!profileLoading && !isComplete && (
        <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5">
          {!profile ? (
            /* Profil pas encore créé */
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Code2 className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Pense à compléter ton profil</p>
                  <p className="text-xs text-muted-foreground">Un profil complet est 3× plus visible des recruteurs.</p>
                </div>
              </div>
              <Button asChild size="sm">
                <Link href="/profile/edit">Compléter <ArrowRight className="size-3.5" /></Link>
              </Button>
            </div>
          ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Code2 className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-medium text-foreground">
                    Complète ton profil développeur
                  </p>
                  <span className="text-sm font-semibold text-primary">
                    {pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-primary/15">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="mt-1.5 text-xs text-muted-foreground">
                  Un profil complet est {pct < 50 ? "3× plus" : "bien"} visible des recruteurs — chaque section compte.
                </p>

                {/* Missing steps */}
                {missingSteps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {missingSteps.map((step) => (
                      <span
                        key={step.key}
                        className="flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/5 px-2.5 py-0.5 text-xs text-destructive/80"
                      >
                        <AlertCircle className="size-3 shrink-0" />
                        {step.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button asChild size="sm" className="shrink-0 self-start">
              <Link href="/profile/edit">
                Compléter <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          )}
        </div>
      )}

      {/* Banner profil 100% complet */}
      {!profileLoading && isComplete && profile && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Profil complet — tu es visible des recruteurs !
          </p>
          <Link href="/profile/edit" className="ml-auto text-xs text-emerald-600 hover:underline dark:text-emerald-400">
            Modifier
          </Link>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Offres correspondantes",
            value: recommendedLoading ? "…" : recommendedOffers.length.toString(),
            icon: <Briefcase className="size-5" />,
            color: "text-primary bg-primary/10",
          },
          {
            label: "Candidatures envoyées",
            value: "0",
            icon: <FileText className="size-5" />,
            color: "text-violet-600 bg-violet-500/10",
          },
          {
            label: "Notifications",
            value: "0",
            icon: <Bell className="size-5" />,
            color: "text-amber-600 bg-amber-500/10",
          },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="card p-5">
            <div className={`mb-3 inline-flex size-9 items-center justify-center rounded-lg ${color}`}>
              {icon}
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Content grid ─────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Offres recommandées */}
        <div className="card p-6">
          <SectionHeader
            title="Offres recommandées"
            action={<Link href="/offres" className="text-xs text-primary hover:underline">Voir tout</Link>}
          />
          {recommendedLoading ? (
            <div className="flex justify-center py-6">
              <div className="size-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : recommendedOffers.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-8" />}
              title="Aucune offre pour l'instant"
              description="Complète ton profil pour recevoir des offres personnalisées."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/profile/edit">Compléter mon profil</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {recommendedOffers.map((offer) => (
                <li key={offer.id}>
                  <Link
                    href={`/offres/${offer.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {offer.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {offer.companyName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="size-3" /> {offer.companyName}
                          </span>
                        )}
                        {offer.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" /> {offer.location}
                          </span>
                        )}
                        {offer.remoteOk && (
                          <span className="flex items-center gap-1">
                            <Wifi className="size-3" /> Remote possible
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {appliedOfferIds.has(offer.id) && (
                        <span className="badge text-[10px] text-emerald-600">
                          <CheckCircle2 className="size-3" /> Déjà postulé
                        </span>
                      )}
                      <span className="badge text-primary">
                        {offer.score}% compatible
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mes projets */}
        <div className="card p-6">
          <SectionHeader
            title={
              <>
                Mes projets
                {visibleProjects.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({visibleProjects.length} visibles)
                  </span>
                )}
              </>
            }
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/profile/edit"><Plus className="size-3.5" /> Gérer</Link>
              </Button>
            }
          />

          {visibleProjects.length === 0 ? (
            <EmptyState
              icon={<GitBranch className="size-8" />}
              title="Aucun projet visible"
              description="Synchronise GitHub et active les projets à montrer."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/profile/edit">Lier GitHub</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleProjects.slice(0, 4).map((project) => (
                <div
                  key={project.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <GitBranch className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {project.title}
                      </span>
                      {project.githubStars !== null && project.githubStars > 0 && (
                        <span className="flex items-center gap-0.5 shrink-0 text-xs text-muted-foreground">
                          <Star className="size-3" />
                          {project.githubStars}
                        </span>
                      )}
                      {project.repoUrl && (
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                    {project.technologies.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {project.technologies.slice(0, 4).map((tech) => (
                          <span
                            key={tech}
                            className="badge"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {visibleProjects.length > 4 && (
                <Link
                  href="/profile/edit"
                  className="block text-center text-xs text-primary hover:underline"
                >
                  +{visibleProjects.length - 4} autres projets
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Mes candidatures */}
        <div className="card p-6 md:col-span-2">
          <SectionHeader
            title="Mes candidatures"
            action={<Link href="/applications" className="text-xs text-primary hover:underline">Voir tout</Link>}
          />
          {applicationsLoading ? (
            <div className="flex justify-center py-6">
              <div className="size-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : applications.length === 0 ? (
            <EmptyState
              icon={<Star className="size-8" />}
              title="Pas encore de candidature"
              description="Explore les offres et candidate en un clic."
              action={
                <Button asChild size="sm">
                  <Link href="/offres">
                    Explorer les offres <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {applications.map((application) => {
                const offer = applicationOffers[application.jobOfferId];
                const pendingDocs = pendingDocsByApplication[application.id] ?? 0;
                const sentAt = new Date(application.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                return (
                  <li key={application.id}>
                    <Link
                      href="/applications"
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {offer?.title ?? "Offre"}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {offer?.companyName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="size-3" /> {offer.companyName}
                            </span>
                          )}
                          {offer?.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {offer.location}
                            </span>
                          )}
                          {offer?.remoteOk && (
                            <span className="flex items-center gap-1">
                              <Wifi className="size-3" /> Remote possible
                            </span>
                          )}
                          <span>Envoyée le {sentAt}</span>
                        </div>
                        {pendingDocs > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <AlertCircle className="size-3" />
                            {pendingDocs === 1
                              ? "1 document demandé"
                              : `${pendingDocs} documents demandés`}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${APPLICATION_STATUS_COLORS[application.status]}`}
                      >
                        {APPLICATION_STATUS_LABELS[application.status]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="mb-3 text-muted-foreground/50">{icon}</div>
      <p className="mb-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

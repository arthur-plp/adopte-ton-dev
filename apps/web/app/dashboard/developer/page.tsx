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
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

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
  technologies: { id: string }[];
  skills: { id: string }[];
  projects: Project[];
};

type CompletionStep = {
  key: string;
  label: string;
  done: boolean;
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
            value: "—",
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
            action={<Link href="/jobs" className="text-xs text-primary hover:underline">Voir tout</Link>}
          />
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
          <EmptyState
            icon={<Star className="size-8" />}
            title="Pas encore de candidature"
            description="Explore les offres et candidate en un clic."
            action={
              <Button asChild size="sm">
                <Link href="/jobs">
                  Explorer les offres <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
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

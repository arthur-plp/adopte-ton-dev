"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/report-dialog";
import { MessageButton } from "@/components/message-button";
import {
  ArrowLeft,
  MapPin,
  Wifi,
  GitBranch,
  Globe,
  Star,
  ExternalLink,
  User,
  Clock,
  Mail,
  Phone,
} from "lucide-react";

type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

type DeveloperSkillItem = {
  id: string;
  level: SkillLevel;
  skill: { id: string; name: string };
};

type DeveloperTechnologyItem = {
  id: string;
  name: string;
  level: SkillLevel;
};

type ProjectItem = {
  id: string;
  title: string;
  description: string;
  repoUrl: string | null;
  liveUrl: string | null;
  technologies: string[];
  githubStars: number | null;
  visible: boolean;
};

type DeveloperProfileDetail = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  bio: string | null;
  location: string | null;
  remoteOk: boolean;
  availability: string;
  githubUrl: string | null;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  phone: string | null;
  email: string;
  skills: DeveloperSkillItem[];
  technologies: DeveloperTechnologyItem[];
  projects: ProjectItem[];
};

const LEVEL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
};

const LEVEL_DOT_COUNT: Record<SkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

const LEVEL_DOT_COLOR: Record<SkillLevel, string> = {
  BEGINNER: "bg-sky-500",
  INTERMEDIATE: "bg-emerald-500",
  ADVANCED: "bg-violet-500",
};

function LevelDots({ level }: { level: SkillLevel }) {
  return (
    <span className="flex items-center gap-0.5" title={LEVEL_LABELS[level]}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`size-1.5 rounded-full ${
            i < LEVEL_DOT_COUNT[level] ? LEVEL_DOT_COLOR[level] : "bg-muted-foreground/20"
          }`}
        />
      ))}
    </span>
  );
}

export default function DeveloperProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const recruiterId = (session?.user as { id?: string } | undefined)?.id;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [profile, setProfile] = useState<DeveloperProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/users/developer/${id}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json() as Promise<DeveloperProfileDetail>;
      })
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => setNotFound(true))
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

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <User className="size-12 text-muted-foreground/40" />
          <h1 className="text-xl font-bold text-foreground">Profil introuvable</h1>
          <p className="text-sm text-muted-foreground">
            Ce profil n&apos;existe pas ou n&apos;est plus disponible.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Retour
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const visibleProjects = profile.projects.filter((p) => p.visible);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="page-container max-w-3xl">
          <div className="mb-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Retour
            </button>
            <div className="flex items-center gap-2">
              {recruiterId && (
                <MessageButton developerId={id} recruiterId={recruiterId} />
              )}
              <ReportDialog targetType="profile" targetId={id} />
            </div>
          </div>

          {/* En-tête */}
          <div className="card mb-6 p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="icon-box size-16 shrink-0 overflow-hidden bg-primary/10 text-lg font-semibold text-primary">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.firstName} {profile.lastName}
                </h1>
                <p className="text-sm font-medium text-foreground/80">
                  {profile.title || (
                    <span className="font-normal text-muted-foreground/70 italic">
                      Titre non renseigné
                    </span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {profile.location || (
                      <span className="text-muted-foreground/70 italic">
                        Localisation non renseignée
                      </span>
                    )}
                  </span>
                  {profile.remoteOk && (
                    <span className="flex items-center gap-1.5">
                      <Wifi className="size-3.5" /> Remote possible
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {profile.availability}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Mail className="size-3.5" /> {profile.email}
                  </a>
                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="size-3.5" /> {profile.phone}
                    </a>
                  )}
                  {profile.githubUrl && (
                    <a
                      href={profile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <GitBranch className="size-3.5" /> GitHub
                    </a>
                  )}
                  {profile.portfolioUrl && (
                    <a
                      href={profile.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Globe className="size-3.5" /> Portfolio
                    </a>
                  )}
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 whitespace-pre-line text-sm text-foreground/80">
              {profile.bio || (
                <span className="text-muted-foreground/70 italic">
                  Aucune biographie renseignée.
                </span>
              )}
            </p>
          </div>

          {/* Technologies */}
          <div className="card mb-6 p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Technologies maîtrisées</h2>
            {profile.technologies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.technologies.map((tech) => (
                  <span key={tech.id} className="badge flex items-center gap-1.5">
                    {tech.name}
                    <LevelDots level={tech.level} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic">
                Aucune technologie renseignée.
              </p>
            )}
          </div>

          {/* Compétences */}
          <div className="card mb-6 p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Compétences</h2>
            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s) => (
                  <span key={s.id} className="badge flex items-center gap-1.5">
                    {s.skill.name}
                    <LevelDots level={s.level} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic">
                Aucune compétence renseignée.
              </p>
            )}
          </div>

          {/* Projets */}
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Projets</h2>
            {visibleProjects.length > 0 ? (
              <div className="space-y-4">
                {visibleProjects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-medium text-foreground">{project.title}</h3>
                      {project.githubStars !== null && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Star className="size-3.5" /> {project.githubStars}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                    {project.technologies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {project.technologies.map((tech) => (
                          <span key={tech} className="badge">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3">
                      {project.repoUrl && (
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <GitBranch className="size-3.5" /> Code source
                        </a>
                      )}
                      {project.liveUrl && (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="size-3.5" /> Démo
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic">
                Aucun projet renseigné.
              </p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

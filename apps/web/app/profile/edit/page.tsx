"use client";

import Link from "next/link";
import { useSession, linkSocial, unlinkAccount } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Save,
  GitBranch,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Star,
  ExternalLink,
  Camera,
  UserRound,
  MapPin,
  Link2,
  ShieldCheck,
  Plus,
  Pencil,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { TechnologiesSection, type Technology } from "./technologies-section";
import { SkillsSection, type DeveloperSkillEntry, type SkillCatalogEntry } from "./skills-section";
import { ProjectForm, type ProjectFormData } from "./project-form";
import { Wrench, BookOpen } from "lucide-react";

const AVAILABILITY_LABELS: Record<string, string> = {
  IMMEDIATE: "Disponible immédiatement",
  ONE_MONTH: "Disponible dans 1 mois",
  LATER: "Disponible plus tard",
  NOT_LOOKING: "Pas en recherche active",
};

type Project = {
  id: string;
  title: string;
  description: string;
  repoUrl: string | null;
  liveUrl: string | null;
  technologies: string[];
  githubStars: number | null;
  githubPushedAt: string | null;
  visible: boolean;
};

type DeveloperProfileData = {
  firstName: string;
  lastName: string;
  title: string;
  bio: string;
  location: string;
  remoteOk: boolean;
  availability: string;
  githubUrl: string;
  portfolioUrl: string;
  linkedinUrl: string;
  avatarUrl: string;
};

const emptyForm: DeveloperProfileData = {
  firstName: "",
  lastName: "",
  title: "",
  bio: "",
  location: "",
  remoteOk: false,
  availability: "IMMEDIATE",
  githubUrl: "",
  portfolioUrl: "",
  linkedinUrl: "",
  avatarUrl: "",
};

export default function ProfileEditPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [form, setForm] = useState<DeveloperProfileData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<{ provider: string; avatarUrl: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [skills, setSkills] = useState<DeveloperSkillEntry[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogEntry[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }

    async function loadProfile() {
      try {
        const [profileRes, projectsRes, techsRes, skillsRes, catalogRes] = await Promise.all([
          fetch(`${apiUrl}/users/me/profile`, { credentials: "include" }),
          fetch(`${apiUrl}/users/developer/me/projects`, { credentials: "include" }),
          fetch(`${apiUrl}/users/developer/me/technologies`, { credentials: "include" }),
          fetch(`${apiUrl}/users/developer/me/skills`, { credentials: "include" }),
          fetch(`${apiUrl}/users/skills/catalog`, { credentials: "include" }),
        ]);
        if (profileRes.ok) {
          const data = (await profileRes.json()) as {
            profile?: Partial<DeveloperProfileData>;
          };
          if (data.profile) {
            setForm({
              firstName: data.profile.firstName ?? "",
              lastName: data.profile.lastName ?? "",
              title: data.profile.title ?? "",
              bio: data.profile.bio ?? "",
              location: data.profile.location ?? "",
              remoteOk: data.profile.remoteOk ?? false,
              availability: data.profile.availability ?? "IMMEDIATE",
              githubUrl: data.profile.githubUrl ?? "",
              portfolioUrl: data.profile.portfolioUrl ?? "",
              linkedinUrl: data.profile.linkedinUrl ?? "",
              avatarUrl: data.profile.avatarUrl ?? "",
            });
          }
        }
        if (projectsRes.ok) {
          const data = (await projectsRes.json()) as Project[] | { error?: unknown };
          if (Array.isArray(data)) setProjects(data);
        }
        if (techsRes.ok) {
          const data = (await techsRes.json()) as Technology[];
          if (Array.isArray(data)) setTechnologies(data);
        }
        if (skillsRes.ok) {
          const data = (await skillsRes.json()) as DeveloperSkillEntry[];
          if (Array.isArray(data)) setSkills(data);
        }
        if (catalogRes.ok) {
          const data = (await catalogRes.json()) as SkillCatalogEntry[];
          if (Array.isArray(data)) setSkillsCatalog(data);
        }

        const avatarRes = await fetch(`${apiUrl}/users/me/avatar-options`, {
          credentials: "include",
        });
        if (avatarRes.ok) {
          const data = (await avatarRes.json()) as { provider: string; avatarUrl: string }[];
          if (Array.isArray(data)) setAvatarOptions(data);
        }
      } catch {
        // ignore — form stays empty
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [session, isPending, apiUrl, router]);

  function set(field: keyof DeveloperProfileData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImage(file, 256);
      set("avatarUrl", dataUrl);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload: Partial<DeveloperProfileData> = {};
    if (form.firstName) payload.firstName = form.firstName;
    if (form.lastName) payload.lastName = form.lastName;
    if (form.title) payload.title = form.title;
    if (form.bio) payload.bio = form.bio;
    if (form.location) payload.location = form.location;
    payload.remoteOk = form.remoteOk;
    payload.availability = form.availability;
    if (form.githubUrl) payload.githubUrl = form.githubUrl;
    if (form.portfolioUrl) payload.portfolioUrl = form.portfolioUrl;
    if (form.linkedinUrl) payload.linkedinUrl = form.linkedinUrl;
    if (form.avatarUrl) payload.avatarUrl = form.avatarUrl;

    try {
      const res = await fetch(`${apiUrl}/users/developer/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json()) as {
          error?: { message?: string };
          message?: string;
        };
        throw new Error(
          data.error?.message ?? data.message ?? "Erreur lors de la sauvegarde"
        );
      }

      setSuccess(true);
      window.dispatchEvent(new CustomEvent("profile:avatar-updated"));
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleGitHubSync() {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/users/developer/me/github-sync`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = (await res.json()) as {
          error?: { message?: string };
          message?: string;
        };
        throw new Error(
          data.error?.message ?? data.message ?? "Erreur lors de la synchronisation"
        );
      }

      const data = (await res.json()) as { synced?: number; skipped?: number };
      const synced = data.synced ?? 0;
      setSyncMessage(
        synced > 0
          ? `${synced} repo${synced > 1 ? "s" : ""} importé${synced > 1 ? "s" : ""} depuis GitHub`
          : "Aucun nouveau repo à importer"
      );

      // Refresh la liste de projets après sync
      const projectsRes = await fetch(`${apiUrl}/users/developer/me/projects`, {
        credentials: "include",
      });
      if (projectsRes.ok) {
        const projectsData = (await projectsRes.json()) as Project[] | { error?: unknown };
        if (Array.isArray(projectsData)) setProjects(projectsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur synchronisation GitHub");
    } finally {
      setSyncing(false);
    }
  }

  async function toggleVisibility(project: Project) {
    setTogglingId(project.id);
    try {
      const res = await fetch(
        `${apiUrl}/users/developer/me/projects/${project.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ visible: !project.visible }),
        }
      );
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, visible: !project.visible } : p
          )
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleUnlink(provider: string) {
    if (avatarOptions.length <= 1) {
      setError("Tu ne peux pas délier ton seul compte de connexion.");
      return;
    }
    setUnlinkingProvider(provider);
    try {
      await unlinkAccount({ providerId: provider });
      setAvatarOptions((prev) => prev.filter((o) => o.provider !== provider));
    } catch {
      setError(`Impossible de délier ${provider}.`);
    } finally {
      setUnlinkingProvider(null);
    }
  }

  async function handleLink(provider: "github" | "google") {
    await linkSocial({ provider, callbackURL: "/profile/edit" });
  }

  async function handleCreateProject(data: ProjectFormData) {
    const res = await fetch(`${apiUrl}/users/developer/me/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...data,
        repoUrl: data.repoUrl || undefined,
        liveUrl: data.liveUrl || undefined,
      }),
    });
    if (!res.ok) {
      const d = (await res.json()) as { message?: string };
      throw new Error(d.message ?? "Erreur");
    }
    const project = (await res.json()) as Project;
    setProjects((prev) => [project, ...prev]);
    setAddingProject(false);
  }

  async function handleEditProject(projectId: string, data: ProjectFormData) {
    const res = await fetch(`${apiUrl}/users/developer/me/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...data,
        repoUrl: data.repoUrl || undefined,
        liveUrl: data.liveUrl || undefined,
      }),
    });
    if (!res.ok) throw new Error("Erreur lors de la mise à jour");
    const updated = (await res.json()) as Project;
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    setEditingProjectId(null);
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    setProjects((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1) as [Project];
      next.splice(index, 0, moved);
      dragIndexRef.current = index;
      return next;
    });
  }

  async function handleDragEnd() {
    dragIndexRef.current = null;
    const order = projects.map((p, i) => ({ id: p.id, displayOrder: i }));
    await fetch(`${apiUrl}/users/developer/me/projects/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order }),
    });
  }

  async function deleteProject(projectId: string) {
    setDeletingId(projectId);
    try {
      const res = await fetch(
        `${apiUrl}/users/developer/me/projects/${projectId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (isPending || loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/dashboard/developer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Mon profil développeur
        </h1>
        <p className="mb-8 text-muted-foreground">
          Ces informations sont visibles par les recruteurs. Un profil complet
          augmente tes chances d&apos;être contacté.
        </p>

        {/* GitHub sync */}
        <div className="mb-8 flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <GitBranch className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Synchroniser avec GitHub
              </p>
              <p className="text-xs text-muted-foreground">
                Importe tes repos publics automatiquement
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={handleGitHubSync}
          >
            {syncing ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {syncing ? "Sync…" : "Synchroniser"}
          </Button>
        </div>

        {syncMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
            <CheckCircle2 className="size-4 shrink-0" />
            {syncMessage}
          </div>
        )}

        {/* Projets GitHub */}
        {projects.length > 0 && (
          <div className="mb-8">
          <Section title={`Projets (${projects.length})`} icon={<GitBranch className="size-4" />}>
            <p className="-mt-2 text-xs text-muted-foreground">
              Active et réordonne les projets à montrer aux recruteurs.
            </p>

            {/* Formulaire d'ajout manuel */}
            {addingProject ? (
              <ProjectForm
                onSave={handleCreateProject}
                onCancel={() => setAddingProject(false)}
                submitLabel="Créer le projet"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingProject(true)}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Plus className="size-4" />
                Ajouter un projet manuellement
              </button>
            )}

            <div className="space-y-3">
              {projects.map((project, index) => (
                <div key={project.id}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={() => void handleDragEnd()}
                  className={`flex cursor-grab items-start gap-3 rounded-xl border p-4 transition-colors active:cursor-grabbing ${
                    project.visible
                      ? "border-border bg-background"
                      : "border-dashed border-border/60 bg-muted/30 opacity-60"
                  }`}
                >
                  {/* Poignée drag */}
                  <div className="mt-0.5 shrink-0 text-muted-foreground/40">
                    <svg viewBox="0 0 8 14" className="size-3.5 fill-current">
                      <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                      <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                      <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                    </svg>
                  </div>
                  {/* Toggle visibilité */}
                  <button
                    type="button"
                    disabled={togglingId === project.id}
                    onClick={() => void toggleVisibility(project)}
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      project.visible
                        ? "border-primary bg-primary text-white"
                        : "border-muted-foreground/40 bg-transparent"
                    }`}
                    title={project.visible ? "Masquer" : "Afficher"}
                  >
                    {project.visible && (
                      <svg viewBox="0 0 10 8" className="size-2.5 fill-current">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Infos projet */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {project.title}
                      </span>
                      {project.githubStars !== null && project.githubStars > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
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
                    {project.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                    {project.technologies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {project.technologies.slice(0, 5).map((tech) => (
                          <span
                            key={tech}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingProjectId(editingProjectId === project.id ? null : project.id)}
                      className="text-muted-foreground/50 transition-colors hover:text-foreground"
                      title="Modifier"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === project.id}
                      onClick={() => void deleteProject(project.id)}
                      className="text-muted-foreground/50 transition-colors hover:text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Formulaire d'édition inline */}
                {editingProjectId === project.id && (
                  <div className="mt-3">
                    <ProjectForm
                      initial={{
                        title: project.title,
                        description: project.description,
                        repoUrl: project.repoUrl ?? "",
                        liveUrl: project.liveUrl ?? "",
                        technologies: project.technologies,
                      }}
                      onSave={(data) => handleEditProject(project.id, data)}
                      onCancel={() => setEditingProjectId(null)}
                      submitLabel="Enregistrer"
                    />
                  </div>
                )}
                </div>
              ))}
            </div>
          </Section>
          </div>
        )}

        {/* Technologies */}
        <div className="mb-8">
          <Section title="Technologies" icon={<Wrench className="size-4" />}>
            <TechnologiesSection
              technologies={technologies}
              apiUrl={apiUrl}
              onUpdate={setTechnologies}
            />
          </Section>
        </div>

        {/* Compétences */}
        <div className="mb-8">
          <Section title="Compétences" icon={<BookOpen className="size-4" />}>
            <SkillsSection
              skills={skills}
              catalog={skillsCatalog}
              apiUrl={apiUrl}
              onUpdate={setSkills}
            />
          </Section>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identité */}
          <Section title="Identité" icon={<UserRound className="size-4" />}>
            {/* Photo de profil */}
            <div className="flex items-start gap-5 pb-2">
              {/* Preview + bouton upload superposé */}
              <div className="relative size-20 shrink-0">
                <div className="size-20 overflow-hidden rounded-2xl bg-muted">
                  {form.avatarUrl ? (
                    <img
                      src={form.avatarUrl}
                      alt="Photo de profil"
                      className="size-full object-cover"
                      onError={() => set("avatarUrl", "")}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
                      {(form.firstName?.[0] ?? session?.user.name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Overlay upload */}
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity hover:opacity-100"
                >
                  {uploadingPhoto ? (
                    <RefreshCw className="size-5 animate-spin text-white" />
                  ) : (
                    <Camera className="size-5 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhotoUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="flex-1 space-y-2 pt-1">
                <p className="text-sm font-medium text-foreground">Photo de profil</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Camera className="size-3.5" />
                    {uploadingPhoto ? "Compression…" : "Importer une photo"}
                  </button>
                  {avatarOptions.map((opt) => (
                    <button
                      key={opt.provider}
                      type="button"
                      onClick={() => set("avatarUrl", opt.avatarUrl)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      <img
                        src={opt.avatarUrl}
                        alt={opt.provider}
                        className="size-4 rounded-full object-cover"
                      />
                      Avatar {opt.provider === "github" ? "GitHub" : "Google"}
                    </button>
                  ))}
                  {form.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => set("avatarUrl", "")}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP — recadré à 256×256
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom">
                <input
                  className="input-base"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  placeholder="Alex"
                />
              </Field>
              <Field label="Nom">
                <input
                  className="input-base"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  placeholder="Dupont"
                />
              </Field>
            </div>

            <Field label="Titre professionnel">
              <input
                className="input-base"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Développeur Fullstack JS"
              />
            </Field>

            <Field label="Bio">
              <textarea
                className="input-base min-h-24 resize-y"
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Décris ton parcours, tes passions tech et ce que tu cherches…"
                maxLength={2000}
              />
              <span className="mt-1 block text-right text-xs text-muted-foreground">
                {form.bio.length}/2000
              </span>
            </Field>
          </Section>

          {/* Localisation & dispo */}
          <Section title="Localisation & disponibilité" icon={<MapPin className="size-4" />}>
            <Field label="Ville / région">
              <input
                className="input-base"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Paris, Lyon, Bordeaux…"
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 rounded border-border accent-primary"
                checked={form.remoteOk}
                onChange={(e) => set("remoteOk", e.target.checked)}
              />
              <span className="text-sm text-foreground">
                Ouvert au télétravail
              </span>
            </label>

            <Field label="Disponibilité">
              <select
                className="input-base"
                value={form.availability}
                onChange={(e) => set("availability", e.target.value)}
              >
                {Object.entries(AVAILABILITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          {/* Liens */}
          <Section title="Liens" icon={<Link2 className="size-4" />}>
            <Field label="Profil GitHub">
              <input
                type="url"
                className="input-base"
                value={form.githubUrl}
                onChange={(e) => set("githubUrl", e.target.value)}
                placeholder="https://github.com/ton-pseudo"
              />
            </Field>
            <Field label="Portfolio">
              <input
                type="url"
                className="input-base"
                value={form.portfolioUrl}
                onChange={(e) => set("portfolioUrl", e.target.value)}
                placeholder="https://ton-portfolio.com"
              />
            </Field>
            <Field label="LinkedIn">
              <input
                type="url"
                className="input-base"
                value={form.linkedinUrl}
                onChange={(e) => set("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/ton-pseudo"
              />
            </Field>
          </Section>

          {/* Comptes OAuth liés */}
          <Section title="Comptes liés" icon={<ShieldCheck className="size-4" />}>
            {(["github", "google"] as const).map((provider) => {
              const linked = avatarOptions.find((o) => o.provider === provider);
              return (
                <div key={provider} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {linked ? (
                      <img src={linked.avatarUrl} alt={provider} className="size-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {provider === "github" ? "GH" : "G"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">{provider}</p>
                      <p className="text-xs text-muted-foreground">
                        {linked ? "Compte lié" : "Non lié"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {linked ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={unlinkingProvider === provider}
                          onClick={() => void handleLink(provider)}
                        >
                          Changer
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={unlinkingProvider === provider || avatarOptions.length <= 1}
                          onClick={() => void handleUnlink(provider)}
                          className="text-destructive hover:text-destructive"
                        >
                          {unlinkingProvider === provider ? "…" : "Délier"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleLink(provider)}
                      >
                        Lier
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Section>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-4 shrink-0" />
              Profil sauvegardé !
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/dashboard/developer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Annuler
            </Link>
            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="size-4" />
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function compressImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      // Cover crop centré
      const ratio = Math.max(size / img.width, size / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("load")); };
    img.src = objectUrl;
  });
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="text-muted-foreground">{icon}</span>
          )}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
        </div>
        <svg
          viewBox="0 0 10 6"
          className={`size-3.5 shrink-0 fill-none stroke-muted-foreground stroke-2 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="space-y-4 px-6 pb-6">{children}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

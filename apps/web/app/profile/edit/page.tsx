"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, unlinkAccount, updateUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  Phone,
  ShieldCheck,
  Plus,
  Pencil,
  Building2,
  Globe,
  Layers,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { TechnologiesSection, type Technology } from "./technologies-section";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { SkillsSection, type DeveloperSkillEntry, type SkillCatalogEntry } from "./skills-section";
import { ProjectForm, type ProjectFormData } from "./project-form";
import { Wrench, BookOpen } from "lucide-react";

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
  country: string;
  remoteOk: boolean;
  availability: string;
  phone: string;
  githubUrl: string;
  portfolioUrl: string;
  linkedinUrl: string;
  avatarUrl: string;
};

type RecruiterProfileData = {
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string;
  companyName: string;
  companySiret: string;
  companyWebsite: string;
  companyDescription: string;
  companyLocation: string;
  companySector: string;
  companySize: string;
};

const emptyDevForm: DeveloperProfileData = {
  firstName: "",
  lastName: "",
  country: "",
  title: "",
  bio: "",
  location: "",
  remoteOk: false,
  availability: "",
  phone: "",
  githubUrl: "",
  portfolioUrl: "",
  linkedinUrl: "",
  avatarUrl: "",
};

const emptyRecruiterForm: RecruiterProfileData = {
  firstName: "",
  lastName: "",
  phone: "",
  avatarUrl: "",
  companyName: "",
  companySiret: "",
  companyWebsite: "",
  companyDescription: "",
  companyLocation: "",
  companySector: "",
  companySize: "",
};

const AUTH_LINK_ERRORS: Record<string, string> = {
  "email_doesn't_match": "L'adresse email de ce compte GitHub ne correspond pas à la tienne. Déconnecte-toi de GitHub puis reconnecte-toi avec le bon compte.",
  "email_doesn_t_match": "L'adresse email de ce compte GitHub ne correspond pas à la tienne. Déconnecte-toi de GitHub puis reconnecte-toi avec le bon compte.",
  oauth_account_not_linked: "Ce compte n'a pas pu être lié. Connecte-toi d'abord avec ton fournisseur habituel.",
  account_not_found: "Aucun compte trouvé pour ce fournisseur.",
};

export default function ProfileEditPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const authErrorHandled = useRef(false);
  useEffect(() => {
    if (authErrorHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (!authError) return;
    authErrorHandled.current = true;
    const msg = AUTH_LINK_ERRORS[authError] ?? "Une erreur est survenue lors de la liaison du compte.";
    const url = new URL(window.location.href);
    url.searchParams.delete("authError");
    window.history.replaceState({}, "", url.toString());
    const isGitHubError = authError.includes("email");
    const t = setTimeout(() => toast.error("Liaison impossible", {
      description: isGitHubError ? (
        <span className="flex flex-col gap-2">
          <span>{msg}</span>
          <a
            href="https://github.com/logout"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
          >
            Se déconnecter de GitHub →
          </a>
        </span>
      ) : msg,
      duration: 8000,
    }), 50);
    return () => clearTimeout(t);
  }, []);

  // ── State commun ──────────────────────────────────────────────────────────
  const [userRole, setUserRole] = useState<"DEVELOPER" | "RECRUITER" | "ADMIN" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<{ provider: string; avatarUrl: string }[]>([]);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State développeur ─────────────────────────────────────────────────────
  const [devForm, setDevForm] = useState<DeveloperProfileData>(emptyDevForm);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [skills, setSkills] = useState<DeveloperSkillEntry[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogEntry[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // ── State recruteur ───────────────────────────────────────────────────────
  const [recruiterForm, setRecruiterForm] = useState<RecruiterProfileData>(emptyRecruiterForm);

  // ── State admin ───────────────────────────────────────────────────────────
  const [adminName, setAdminName] = useState("");

  // ── Chargement du profil ──────────────────────────────────────────────────
  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }

    async function loadProfile() {
      try {
        const profileRes = await fetch(`${apiUrl}/users/me/profile`, { credentials: "include" });

        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            router.replace("/sign-in");
            return;
          }
          const errBody = await profileRes.json().catch(() => ({})) as { message?: string };
          setLoadError(`Erreur ${profileRes.status} : ${errBody.message ?? 'Impossible de charger le profil'}`);
          return;
        }

        if (profileRes.ok) {
          const data = (await profileRes.json()) as {
            role?: "DEVELOPER" | "RECRUITER" | "ADMIN";
            profile?: Record<string, unknown> & {
              firstName?: string;
              lastName?: string;
              title?: string;
              bio?: string;
              location?: string;
              remoteOk?: boolean;
              availability?: string;
              phone?: string;
              githubUrl?: string;
              portfolioUrl?: string;
              linkedinUrl?: string;
              avatarUrl?: string;
              company?: { name?: string };
            };
          };

          const role = data.role ?? null;
          setUserRole(role);

          if (role === "DEVELOPER" && data.profile) {
            setDevForm({
              firstName: data.profile.firstName ?? "",
              lastName: data.profile.lastName ?? "",
              title: data.profile.title ?? "",
              bio: data.profile.bio ?? "",
              location: data.profile.location ?? "",
              country: (data.profile as { country?: string }).country ?? "",
              remoteOk: data.profile.remoteOk ?? false,
              availability: data.profile.availability ?? "",
              phone: data.profile.phone ?? "",
              githubUrl: data.profile.githubUrl ?? "",
              portfolioUrl: data.profile.portfolioUrl ?? "",
              linkedinUrl: data.profile.linkedinUrl ?? "",
              avatarUrl: data.profile.avatarUrl ?? "",
            });

            const [projectsRes, techsRes, skillsRes, catalogRes] = await Promise.all([
              fetch(`${apiUrl}/users/developer/me/projects`, { credentials: "include" }),
              fetch(`${apiUrl}/users/developer/me/technologies`, { credentials: "include" }),
              fetch(`${apiUrl}/users/developer/me/skills`, { credentials: "include" }),
              fetch(`${apiUrl}/users/skills/catalog`, { credentials: "include" }),
            ]);
            if (projectsRes.ok) {
              const d = (await projectsRes.json()) as Project[] | { error?: unknown };
              if (Array.isArray(d)) setProjects(d);
            }
            if (techsRes.ok) {
              const d = (await techsRes.json()) as Technology[];
              if (Array.isArray(d)) setTechnologies(d);
            }
            if (skillsRes.ok) {
              const d = (await skillsRes.json()) as DeveloperSkillEntry[];
              if (Array.isArray(d)) setSkills(d);
            }
            if (catalogRes.ok) {
              const d = (await catalogRes.json()) as SkillCatalogEntry[];
              if (Array.isArray(d)) setSkillsCatalog(d);
            }
          }

          if (role === "RECRUITER" && data.profile) {
            setRecruiterForm({
              firstName: data.profile.firstName ?? "",
              lastName: data.profile.lastName ?? "",
              phone: data.profile.phone ?? "",
              avatarUrl: data.profile.avatarUrl ?? "",
              companyName: data.profile.company?.name ?? "",
              companySiret: (data.profile.company as Record<string, unknown>)?.['siret'] as string ?? "",
              companyWebsite: (data.profile.company as Record<string, unknown>)?.['website'] as string ?? "",
              companyDescription: (data.profile.company as Record<string, unknown>)?.['description'] as string ?? "",
              companyLocation: (data.profile.company as Record<string, unknown>)?.['location'] as string ?? "",
              companySector: (data.profile.company as Record<string, unknown>)?.['sector'] as string ?? "",
              companySize: (data.profile.company as Record<string, unknown>)?.['size'] as string ?? "",
            });
          }

          if (role === "ADMIN") {
            setAdminName(session?.user.name ?? "");
          }
        }

        const avatarRes = await fetch(`${apiUrl}/users/me/avatar-options`, { credentials: "include" });
        if (avatarRes.ok) {
          const d = (await avatarRes.json()) as { provider: string; avatarUrl: string }[];
          if (Array.isArray(d)) setAvatarOptions(d);
        }

        const accountsRes = await fetch("/api/auth/list-accounts", { credentials: "include" });
        if (accountsRes.ok) {
          const accounts = (await accountsRes.json()) as { providerId?: string }[];
          if (Array.isArray(accounts)) {
            setLinkedProviders(accounts.map((a) => a.providerId ?? "").filter(Boolean));
          }
        }
      } catch {
        // ignore — form stays empty
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [session, isPending, apiUrl, router]);

  // ── Helpers communs ───────────────────────────────────────────────────────

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImage(file, 256);
      if (userRole === "RECRUITER") {
        setRecruiterForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
      } else if (userRole === "ADMIN") {
        setAdminAvatarUrl(dataUrl);
      } else {
        setDevForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  function setAvatarFromOption(url: string) {
    if (userRole === "RECRUITER") {
      setRecruiterForm((prev) => ({ ...prev, avatarUrl: url }));
    } else if (userRole === "ADMIN") {
      setAdminAvatarUrl(url);
    } else {
      setDevForm((prev) => ({ ...prev, avatarUrl: url }));
    }
  }

  function clearAvatar() {
    if (userRole === "RECRUITER") {
      setRecruiterForm((prev) => ({ ...prev, avatarUrl: "" }));
    } else if (userRole === "ADMIN") {
      setAdminAvatarUrl("");
    } else {
      setDevForm((prev) => ({ ...prev, avatarUrl: "" }));
    }
  }

  const [adminAvatarUrl, setAdminAvatarUrl] = useState(session?.user.image ?? "");
  const currentAvatarUrl = userRole === "RECRUITER"
    ? recruiterForm.avatarUrl
    : userRole === "ADMIN"
    ? adminAvatarUrl
    : devForm.avatarUrl;

  async function handleUnlink(provider: string) {
    if (linkedProviders.length <= 1) {
      setError("Tu ne peux pas délier ton seul compte de connexion.");
      return;
    }
    setUnlinkingProvider(provider);
    try {
      await unlinkAccount({ providerId: provider });
      setAvatarOptions((prev) => prev.filter((o) => o.provider !== provider));
      setLinkedProviders((prev) => prev.filter((p) => p !== provider));
    } catch {
      setError(`Impossible de délier ${provider}.`);
    } finally {
      setUnlinkingProvider(null);
    }
  }

  async function handleLink(provider: "github" | "google") {
    try {
      const res = await fetch("/api/auth/link-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider, callbackURL: "/profile/edit" }),
      });
      const text = await res.text();
      let data: { url?: string; error?: { message?: string }; message?: string } = {};
      try { data = JSON.parse(text) as typeof data; } catch { /* non-JSON */ }
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(`Impossible de lier ${provider}`, {
          description: data.error?.message ?? data.message ?? `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      toast.error(`Impossible de lier ${provider}`, {
        description: e instanceof Error ? e.message : "Erreur réseau",
      });
    }
  }

  // ── Submit développeur ────────────────────────────────────────────────────

  async function handleDevSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload: Partial<DeveloperProfileData> = {};
    if (devForm.firstName) payload.firstName = devForm.firstName;
    if (devForm.lastName) payload.lastName = devForm.lastName;
    if (devForm.title) payload.title = devForm.title;
    if (devForm.bio) payload.bio = devForm.bio;
    if (devForm.location) payload.location = devForm.location;
    if (devForm.country) payload.country = devForm.country;
    payload.remoteOk = devForm.remoteOk;
    if (devForm.availability) payload.availability = devForm.availability;
    if (devForm.phone) payload.phone = devForm.phone;
    if (devForm.githubUrl) payload.githubUrl = devForm.githubUrl;
    if (devForm.portfolioUrl) payload.portfolioUrl = devForm.portfolioUrl;
    if (devForm.linkedinUrl) payload.linkedinUrl = devForm.linkedinUrl;
    if (devForm.avatarUrl) payload.avatarUrl = devForm.avatarUrl;

    try {
      const res = await fetch(`${apiUrl}/users/developer/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string }; message?: string };
        throw new Error(data.error?.message ?? data.message ?? "Erreur lors de la sauvegarde");
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

  // ── Submit recruteur ──────────────────────────────────────────────────────

  async function handleRecruiterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload: Partial<RecruiterProfileData> = {};
    if (recruiterForm.firstName) payload.firstName = recruiterForm.firstName;
    if (recruiterForm.lastName) payload.lastName = recruiterForm.lastName;
    if (recruiterForm.phone) payload.phone = recruiterForm.phone;
    if (recruiterForm.avatarUrl) payload.avatarUrl = recruiterForm.avatarUrl;
    if (recruiterForm.companyName) payload.companyName = recruiterForm.companyName;
    payload.companyWebsite = recruiterForm.companyWebsite || "";
    payload.companyDescription = recruiterForm.companyDescription;
    payload.companyLocation = recruiterForm.companyLocation;
    payload.companySector = recruiterForm.companySector;
    payload.companySize = recruiterForm.companySize;

    try {
      const res = await fetch(`${apiUrl}/users/recruiter/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string }; message?: string };
        throw new Error(data.error?.message ?? data.message ?? "Erreur lors de la sauvegarde");
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

  // ── Submit admin ─────────────────────────────────────────────────────────

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const avatarUrl = currentAvatarUrl;
      await updateUser({ name: adminName, image: avatarUrl || undefined });
      setSuccess(true);
      window.dispatchEvent(new CustomEvent("profile:avatar-updated"));
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  // ── Actions développeur (GitHub sync, projets) ────────────────────────────

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
        const data = (await res.json()) as { error?: { message?: string }; message?: string };
        throw new Error(data.error?.message ?? data.message ?? "Erreur lors de la synchronisation");
      }
      const data = (await res.json()) as { synced?: number; skipped?: number };
      const synced = data.synced ?? 0;
      setSyncMessage(
        synced > 0
          ? `${synced} repo${synced > 1 ? "s" : ""} importé${synced > 1 ? "s" : ""} depuis GitHub`
          : "Aucun nouveau repo à importer"
      );
      const projectsRes = await fetch(`${apiUrl}/users/developer/me/projects`, { credentials: "include" });
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
      const res = await fetch(`${apiUrl}/users/developer/me/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ visible: !project.visible }),
      });
      if (res.ok) {
        setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, visible: !project.visible } : p));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreateProject(data: ProjectFormData) {
    const res = await fetch(`${apiUrl}/users/developer/me/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...data, repoUrl: data.repoUrl || undefined, liveUrl: data.liveUrl || undefined }),
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
      body: JSON.stringify({ ...data, repoUrl: data.repoUrl || undefined, liveUrl: data.liveUrl || undefined }),
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
      const res = await fetch(`${apiUrl}/users/developer/me/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

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

  if (!userRole) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-sm px-4">
            <p className="text-sm text-muted-foreground">
              {loadError ?? "Impossible de charger le profil."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dashboardHref = userRole === "RECRUITER" ? "/dashboard/recruiter" : "/dashboard/developer";

  // ── Section comptes liés (commune) ────────────────────────────────────────

  const linkedAccountsSection = (
    <Section title="Comptes liés" icon={<ShieldCheck className="size-4" />}>
      {(["github", "google"] as const).map((provider) => {
        const isLinked = linkedProviders.includes(provider);
        const avatarOpt = avatarOptions.find((o) => o.provider === provider);
        return (
          <div key={provider} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {avatarOpt ? (
                <Image src={avatarOpt.avatarUrl} alt={provider} width={32} height={32} className="rounded-full object-cover" />
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  {provider === "github" ? <GitHubIcon /> : <GoogleIcon />}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground capitalize">{provider}</p>
                <p className="text-xs text-muted-foreground">{isLinked ? "Compte lié" : "Non lié"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLinked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={unlinkingProvider === provider || linkedProviders.length <= 1}
                  onClick={() => void handleUnlink(provider)}
                  className="text-destructive hover:text-destructive"
                >
                  {unlinkingProvider === provider ? "…" : "Délier"}
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => void handleLink(provider)}>
                  Lier
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {linkedProviders.includes("github") && linkedProviders.includes("google") && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-foreground/80">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Ton compte GitHub et ton compte Google partagent la même adresse email — ils ont été liés automatiquement.
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Pour changer de compte, délie-le puis relie-en un nouveau. Si ton compte{" "}
        <a href="https://github.com/settings/applications" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">GitHub</a>
        {" "}ou{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Google</a>
        {" "}a déjà autorisé l&apos;app, la reconnexion sera immédiate.
      </p>
    </Section>
  );

  // ── Section photo de profil (commune) ─────────────────────────────────────

  const avatarSection = (
    <div className="flex items-start gap-5 pb-2">
      <div className="relative size-20 shrink-0">
        <div className="size-20 overflow-hidden rounded-2xl bg-muted">
          {currentAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentAvatarUrl}
              alt="Photo de profil"
              className="size-full object-cover"
              onError={() => clearAvatar()}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
              {(
                (userRole === "RECRUITER" ? recruiterForm.firstName : devForm.firstName)?.[0] ??
                session?.user.name?.[0] ??
                "?"
              ).toUpperCase()}
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={uploadingPhoto}
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity hover:opacity-100"
        >
          {uploadingPhoto ? <RefreshCw className="size-5 animate-spin text-white" /> : <Camera className="size-5 text-white" />}
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
              onClick={() => setAvatarFromOption(opt.avatarUrl)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <Image src={opt.avatarUrl} alt={opt.provider} width={16} height={16} className="rounded-full object-cover" />
              Avatar {opt.provider === "github" ? "GitHub" : "Google"}
            </button>
          ))}
          {currentAvatarUrl && (
            <button type="button" onClick={() => clearAvatar()} className="text-xs text-muted-foreground hover:text-destructive">
              Supprimer
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP — recadré à 256×256</p>
      </div>
    </div>
  );

  // ── Formulaire admin ─────────────────────────────────────────────────────

  if (userRole === "ADMIN") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/dashboard/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="size-4" />
              Retour
            </Link>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">Mon profil</h1>
          <p className="mb-8 text-muted-foreground">Nom affiché et photo de profil.</p>

          {linkedAccountsSection}

          <div className="mt-8" />

          <form onSubmit={handleAdminSubmit} className="space-y-6">
            <Section title="Identité" icon={<UserRound className="size-4" />}>
              {avatarSection}
              <Field label="Nom affiché">
                <input
                  className="input-base"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Prénom Nom"
                />
              </Field>
            </Section>

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

            <div className="flex items-center justify-between pt-2">
              <Link href="/dashboard/admin" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
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

  // ── Formulaire recruteur ──────────────────────────────────────────────────

  if (userRole === "RECRUITER") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/dashboard/recruiter" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="size-4" />
              Retour
            </Link>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">Mon profil recruteur</h1>
          <p className="mb-8 text-muted-foreground">
            Ces informations sont visibles par les développeurs que vous contactez.
          </p>

          {linkedAccountsSection}

          <div className="mt-8" />

          <form onSubmit={handleRecruiterSubmit} className="space-y-6">
            <Section title="Identité" icon={<UserRound className="size-4" />}>
              {avatarSection}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom">
                  <input
                    className="input-base"
                    value={recruiterForm.firstName}
                    onChange={(e) => setRecruiterForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Marie"
                  />
                </Field>
                <Field label="Nom">
                  <input
                    className="input-base"
                    value={recruiterForm.lastName}
                    onChange={(e) => setRecruiterForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Dupont"
                  />
                </Field>
              </div>
            </Section>

            <Section title="Contact" icon={<Phone className="size-4" />}>
              <Field label="Téléphone">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    className="input-base pl-9"
                    value={recruiterForm.phone}
                    onChange={(e) => setRecruiterForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+33 6 12 34 56 78"
                    maxLength={30}
                  />
                </div>
              </Field>
            </Section>

            <Section title="Entreprise" icon={<Building2 className="size-4" />}>
              <Field label="Nom de l'entreprise">
                {recruiterForm.companyName ? (
                  <>
                    <div className="input-base cursor-not-allowed bg-muted/50 text-muted-foreground">
                      {recruiterForm.companyName}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Le nom est géré par l&apos;administrateur.
                    </p>
                  </>
                ) : (
                  <input
                    className="input-base"
                    value={recruiterForm.companyName}
                    onChange={(e) => setRecruiterForm((prev) => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Acme SAS"
                    maxLength={200}
                  />
                )}
              </Field>

              <Field label="SIRET">
                <div className="input-base cursor-not-allowed bg-muted/50 font-mono tracking-wider text-muted-foreground">
                  {recruiterForm.companySiret || "Non renseigné"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vérifié par l&apos;administrateur lors de la création du compte, non modifiable.
                </p>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ville">
                  <CityAutocomplete
                    city={recruiterForm.companyLocation}
                    country=""
                    onChange={(city) => setRecruiterForm((prev) => ({ ...prev, companyLocation: city }))}
                    placeholder="Paris, Lyon, Berlin…"
                  />
                </Field>
                <Field label="Secteur d'activité">
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="input-base pl-9"
                      value={recruiterForm.companySector}
                      onChange={(e) => setRecruiterForm((prev) => ({ ...prev, companySector: e.target.value }))}
                      placeholder="SaaS, Fintech, E-commerce…"
                      maxLength={100}
                    />
                  </div>
                </Field>
              </div>

              <Field label="Taille de l'entreprise">
                <div className="flex flex-wrap gap-2">
                  {["1-10", "10-50", "50-200", "200-500", "500+"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setRecruiterForm((prev) => ({ ...prev, companySize: prev.companySize === size ? "" : size }))}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        recruiterForm.companySize === size
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {size} salariés
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Site web">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="url"
                    className="input-base pl-9"
                    value={recruiterForm.companyWebsite}
                    onChange={(e) => setRecruiterForm((prev) => ({ ...prev, companyWebsite: e.target.value }))}
                    placeholder="https://votre-entreprise.com"
                    maxLength={300}
                  />
                </div>
              </Field>

              <Field label="Description de l'entreprise">
                <textarea
                  className="input-base min-h-24 resize-y"
                  value={recruiterForm.companyDescription}
                  onChange={(e) => setRecruiterForm((prev) => ({ ...prev, companyDescription: e.target.value }))}
                  placeholder="Présentez votre entreprise, votre culture, vos projets…"
                  maxLength={2000}
                />
                <span className="mt-1 block text-right text-xs text-muted-foreground">
                  {recruiterForm.companyDescription.length}/2000
                </span>
              </Field>
            </Section>

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

            <div className="flex items-center justify-between pt-2">
              <Link href="/dashboard/recruiter" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
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

  // ── Formulaire développeur (rôle DEVELOPER ou non encore déterminé) ───────

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href={dashboardHref}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">Mon profil développeur</h1>
        <p className="mb-8 text-muted-foreground">
          Ces informations sont visibles par les recruteurs. Un profil complet augmente tes chances d&apos;être contacté.
        </p>

        {linkedAccountsSection}

        {/* GitHub sync */}
        {(() => {
          const isGitHubLinked = avatarOptions.some((o) => o.provider === "github");
          return (
            <div className={`my-8 flex items-center justify-between rounded-2xl border bg-card px-5 py-4 transition-opacity ${isGitHubLinked ? "border-border" : "border-border opacity-50"}`}>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <GitBranch className="size-4 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Synchroniser avec GitHub</p>
                  <p className="text-xs text-muted-foreground">
                    {isGitHubLinked ? "Importe tes repos publics automatiquement" : "Lie ton compte GitHub dans « Comptes liés » pour activer la sync"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={!isGitHubLinked || syncing} onClick={() => void handleGitHubSync()}>
                <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sync…" : "Synchroniser"}
              </Button>
            </div>
          );
        })()}

        {syncMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
            <CheckCircle2 className="size-4 shrink-0" />
            {syncMessage}
          </div>
        )}

        {/* Projets */}
        {projects.length > 0 && (
          <div className="mb-8">
            <Section title={`Projets (${projects.length})`} icon={<GitBranch className="size-4" />}>
              <p className="-mt-2 text-xs text-muted-foreground">Active et réordonne les projets à montrer aux recruteurs.</p>

              {addingProject ? (
                <ProjectForm onSave={handleCreateProject} onCancel={() => setAddingProject(false)} submitLabel="Créer le projet" />
              ) : (
                <button type="button" onClick={() => setAddingProject(true)} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
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
                        project.visible ? "border-border bg-background" : "border-dashed border-border/60 bg-muted/30 opacity-60"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 text-muted-foreground/40">
                        <svg viewBox="0 0 8 14" className="size-3.5 fill-current">
                          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                          <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                          <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                        </svg>
                      </div>
                      <button
                        type="button"
                        disabled={togglingId === project.id}
                        onClick={() => void toggleVisibility(project)}
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          project.visible ? "border-primary bg-primary text-white" : "border-muted-foreground/40 bg-transparent"
                        }`}
                        title={project.visible ? "Masquer" : "Afficher"}
                      >
                        {project.visible && (
                          <svg viewBox="0 0 10 8" className="size-2.5 fill-current">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{project.title}</span>
                          {project.githubStars !== null && project.githubStars > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Star className="size-3" />
                              {project.githubStars}
                            </span>
                          )}
                          {project.repoUrl && (
                            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                        {project.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>}
                        {project.technologies.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {project.technologies.slice(0, 5).map((tech) => (
                              <span key={tech} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tech}</span>
                            ))}
                          </div>
                        )}
                      </div>
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
            <TechnologiesSection technologies={technologies} apiUrl={apiUrl} onUpdate={setTechnologies} />
          </Section>
        </div>

        {/* Compétences */}
        <div className="mb-8">
          <Section title="Compétences" icon={<BookOpen className="size-4" />}>
            <SkillsSection skills={skills} catalog={skillsCatalog} apiUrl={apiUrl} onUpdate={setSkills} />
          </Section>
        </div>

        <form onSubmit={handleDevSubmit} className="space-y-6">
          <Section title="Identité" icon={<UserRound className="size-4" />}>
            {avatarSection}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom">
                <input
                  className="input-base"
                  value={devForm.firstName}
                  onChange={(e) => setDevForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Alex"
                />
              </Field>
              <Field label="Nom">
                <input
                  className="input-base"
                  value={devForm.lastName}
                  onChange={(e) => setDevForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Dupont"
                />
              </Field>
            </div>

            <Field label="Titre professionnel">
              <input
                className="input-base"
                value={devForm.title}
                onChange={(e) => setDevForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Développeur Fullstack JS"
              />
            </Field>

            <Field label="Bio">
              <textarea
                className="input-base min-h-24 resize-y"
                value={devForm.bio}
                onChange={(e) => setDevForm((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Décris ton parcours, tes passions tech et ce que tu cherches…"
                maxLength={2000}
              />
              <span className="mt-1 block text-right text-xs text-muted-foreground">{devForm.bio.length}/2000</span>
            </Field>
          </Section>

          <Section title="Localisation & disponibilité" icon={<MapPin className="size-4" />}>
            <Field label="Ville">
              <CityAutocomplete
                city={devForm.location}
                country={devForm.country}
                onChange={(city, country) => setDevForm((prev) => ({ ...prev, location: city, country }))}
                placeholder="Paris, Lyon, Berlin…"
              />
              {devForm.country && (
                <p className="mt-1 text-xs text-muted-foreground">{devForm.country}</p>
              )}
            </Field>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 rounded border-border accent-primary"
                checked={devForm.remoteOk}
                onChange={(e) => setDevForm((prev) => ({ ...prev, remoteOk: e.target.checked }))}
              />
              <span className="text-sm text-foreground">Ouvert au télétravail</span>
            </label>

            <Field label="Disponibilité">
              <input
                className="input-base"
                value={devForm.availability}
                onChange={(e) => setDevForm((prev) => ({ ...prev, availability: e.target.value }))}
                placeholder="Ex : Disponible immédiatement, fin d'alternance en sept. 2026…"
                maxLength={200}
              />
            </Field>
          </Section>

          <Section title="Liens & contact" icon={<Link2 className="size-4" />}>
            <Field label="Téléphone">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  className="input-base pl-9"
                  value={devForm.phone}
                  onChange={(e) => setDevForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+33 6 12 34 56 78"
                  maxLength={30}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Visible uniquement par les recruteurs qui t&apos;ont contacté.
              </p>
            </Field>
            <Field label="Profil GitHub">
              <input
                type="url"
                className="input-base"
                value={devForm.githubUrl}
                onChange={(e) => setDevForm((prev) => ({ ...prev, githubUrl: e.target.value }))}
                placeholder="https://github.com/ton-pseudo"
              />
            </Field>
            <Field label="Portfolio">
              <input
                type="url"
                className="input-base"
                value={devForm.portfolioUrl}
                onChange={(e) => setDevForm((prev) => ({ ...prev, portfolioUrl: e.target.value }))}
                placeholder="https://ton-portfolio.com"
              />
            </Field>
            <Field label="LinkedIn">
              <input
                type="url"
                className="input-base"
                value={devForm.linkedinUrl}
                onChange={(e) => setDevForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
                placeholder="https://linkedin.com/in/ton-pseudo"
              />
            </Field>
          </Section>

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

          <div className="flex items-center justify-between pt-2">
            <Link href={dashboardHref} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
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

// ── Icônes ────────────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg className="size-4 fill-current text-foreground" viewBox="0 0 24 24" aria-hidden="true">
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

// ── Utilitaires ───────────────────────────────────────────────────────────────

function compressImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new globalThis.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
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
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

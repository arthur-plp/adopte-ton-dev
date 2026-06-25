"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  Users, Code2, Briefcase, Search,
  ChevronLeft, ChevronRight, ShieldAlert,
  Plus, X, Eye, EyeOff, Pencil, Trash2, AlertTriangle,
  CheckCircle2, XCircle, Clock, MapPin, Wifi, Euro,
  History, MessageSquare, FileText, TrendingUp, Flag, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminStatsCharts } from "./admin-stats-charts";
import { MessageButton } from "@/components/message-button";

type Stats = {
  users: { total: number; developers: number; recruiters: number; admins: number };
  jobOffers: {
    total: number;
    draft: number;
    pendingReview: number;
    approved: number;
    published: number;
    rejected: number;
    archived: number;
  };
  applications: {
    total: number;
    sent: number;
    viewed: number;
    interview: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
    acceptanceRate: number;
  };
};

type PendingOffer = {
  id: string;
  title: string;
  description: string;
  companyId: string;
  companyName: string | null;
  recruiterId: string;
  type: "INTERNSHIP" | "APPRENTICESHIP" | "FIRST_JOB";
  location: string | null;
  country: string | null;
  remoteOk: boolean;
  requiredTechnologies: string[];
  requiredTechLevels: Record<string, string> | null;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedOffers = { data: PendingOffer[]; total: number; page: number; pageSize: number };

type ReportRow = {
  id: string;
  reporterId: string;
  targetType: "profile" | "job";
  targetId: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
};

type PaginatedReports = { data: ReportRow[]; total: number; page: number; pageSize: number };

type ActiveTab = "stats" | "users" | "offers" | "reports";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  onboarded: boolean;
  createdAt: string;
  recruiterProfile: {
    firstName: string;
    lastName: string;
    company: { name: string; siret: string | null } | null;
  } | null;
};

type Paginated = { data: UserRow[]; total: number; page: number; pageSize: number };

const ROLE_COLORS: Record<string, string> = {
  DEVELOPER: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  RECRUITER: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  ADMIN: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: "Développeur",
  RECRUITER: "Recruteur",
  ADMIN: "Admin",
};

type RoleFilter = "ALL" | "DEVELOPER" | "RECRUITER" | "ADMIN";

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "DEVELOPER", label: "Développeurs" },
  { value: "RECRUITER", label: "Recruteurs" },
  { value: "ADMIN", label: "Admins" },
];

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function AdminDashboard() {
  const { data: session, isPending } = useSession();
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [result, setResult] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);

  // Offres en attente
  const [pendingOffers, setPendingOffers] = useState<PaginatedOffers | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerPage, setOfferPage] = useState(1);
  const [moderatingOffer, setModeratingOffer] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingOffer | null>(null);
  const [viewingOffer, setViewingOffer] = useState<PendingOffer | null>(null);

  // Signalements
  const [reports, setReports] = useState<PaginatedReports | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportStatusFilter, setReportStatusFilter] = useState<"open" | "resolved" | "dismissed" | "ALL">("open");
  const [moderatingReport, setModeratingReport] = useState<string | null>(null);
  const [openReportsCount, setOpenReportsCount] = useState(0);

  const isAdmin = !isPending && !!session && (session.user as { role?: string }).role === "ADMIN";

  useEffect(() => {
    if (isPending) return;
    if (!session) { router.replace("/sign-in"); return; }
    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN") { router.replace("/dashboard"); return; }
  }, [session, isPending, router]);

  const fetchStats = useCallback(async () => {
    const r = await fetch(`${apiUrl}/admin/stats`, { credentials: "include" }).catch(() => null);
    if (r?.ok) setStats(await r.json() as Stats);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchStats();
  }, [isAdmin, fetchStats]);

  const fetchUsers = useCallback(async (p: number, q: string, rf: RoleFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p.toString(), pageSize: "15" });
    if (q.trim()) params.set("search", q.trim());
    if (rf !== "ALL") params.set("role", rf);
    try {
      const res = await fetch(`${apiUrl}/admin/users?${params}`, { credentials: "include" });
      if (res.ok) setResult(await res.json() as Paginated);
    } catch {
      // erreur réseau — gateway non disponible
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => { setPage(1); void fetchUsers(1, search, roleFilter); }, 300);
    return () => clearTimeout(t);
  }, [search, roleFilter, fetchUsers, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchUsers(page, search, roleFilter);
  }, [page, fetchUsers, search, roleFilter, isAdmin]);

  function handleCreated() {
    setShowCreateForm(false);
    void fetchUsers(1, search, roleFilter);
    void fetchStats();
    toast.success("Compte recruteur créé !");
  }

  function handleUpdated(updated: UserRow) {
    setEditingUser(null);
    setResult((prev) => prev
      ? { ...prev, data: prev.data.map((u) => u.id === updated.id ? { ...u, ...updated } : u) }
      : prev
    );
    void fetchStats();
    toast.success("Utilisateur modifié.");
  }

  function handleDeleted(userId: string) {
    setDeletingUser(null);
    setResult((prev) => prev
      ? { ...prev, data: prev.data.filter((u) => u.id !== userId), total: prev.total - 1 }
      : prev
    );
    void fetchStats();
    toast.success("Utilisateur supprimé.");
  }

  const fetchPendingOffers = useCallback(async (p: number) => {
    setOffersLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/job-offers?page=${p}&pageSize=10`, { credentials: "include" });
      if (res.ok) setPendingOffers(await res.json() as PaginatedOffers);
    } catch { /* ignore */ } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchPendingOffers(offerPage);
  }, [isAdmin, offerPage, fetchPendingOffers]);

  async function handleApprove(id: string) {
    setModeratingOffer(id);
    try {
      const res = await fetch(`${apiUrl}/admin/job-offers/${id}/approve`, { method: "POST", credentials: "include" });
      if (res.ok) {
        setPendingOffers((prev) => prev ? { ...prev, data: prev.data.filter((o) => o.id !== id), total: prev.total - 1 } : prev);
        toast.success("Offre approuvée. Le recruteur peut désormais la publier quand il le souhaite.");
      } else {
        toast.error("Erreur lors de l'approbation de l'offre.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally { setModeratingOffer(null); }
  }

  async function handleReject(id: string, reason: string) {
    setModeratingOffer(id);
    try {
      const res = await fetch(`${apiUrl}/admin/job-offers/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setPendingOffers((prev) => prev ? { ...prev, data: prev.data.filter((o) => o.id !== id), total: prev.total - 1 } : prev);
        setRejectTarget(null);
        toast.success("Demande de modifications envoyée au recruteur.");
      } else {
        toast.error("Erreur lors de l'envoi de la demande de modifications.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally { setModeratingOffer(null); }
  }

  const fetchReports = useCallback(async (p: number, status: typeof reportStatusFilter) => {
    setReportsLoading(true);
    const params = new URLSearchParams({ page: p.toString(), pageSize: "10" });
    if (status !== "ALL") params.set("status", status);
    try {
      const res = await fetch(`${apiUrl}/admin/reports?${params}`, { credentials: "include" });
      if (res.ok) setReports(await res.json() as PaginatedReports);
    } catch { /* ignore */ } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchReports(reportPage, reportStatusFilter);
  }, [isAdmin, reportPage, reportStatusFilter, fetchReports]);

  const fetchOpenReportsCount = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/reports?status=open&page=1&pageSize=1`, { credentials: "include" });
      if (res.ok) setOpenReportsCount((await res.json() as PaginatedReports).total);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchOpenReportsCount();
  }, [isAdmin, fetchOpenReportsCount]);

  async function handleReportStatus(id: string, status: "resolved" | "dismissed") {
    setModeratingReport(id);
    try {
      const res = await fetch(`${apiUrl}/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReports((prev) => prev ? { ...prev, data: prev.data.filter((r) => r.id !== id), total: prev.total - 1 } : prev);
        setOpenReportsCount((c) => Math.max(0, c - 1));
        toast.success(status === "resolved" ? "Signalement résolu." : "Signalement rejeté.");
      } else {
        toast.error("Erreur lors de la mise à jour du signalement.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally { setModeratingReport(null); }
  }

  if (isPending || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalPages = result ? Math.ceil(result.total / 15) : 0;
  const pendingCount = pendingOffers?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
            <ShieldAlert className="size-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Administration</h1>
            <p className="text-sm text-muted-foreground">Gestion de la plateforme</p>
          </div>
        </div>
        {activeTab === "users" && (
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="size-4" />
            Créer un recruteur
          </Button>
        )}
      </div>

      {/* Onglets */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("stats")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "stats" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2"><BarChart3 className="size-4" />Statistiques</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "users" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2"><Users className="size-4" />Utilisateurs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("offers")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "offers" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2">
            <Briefcase className="size-4" />
            Modération des offres
            {pendingCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">{pendingCount}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "reports" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-2">
            <Flag className="size-4" />
            Signalements
            {openReportsCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">{openReportsCount}</span>
            )}
          </span>
        </button>
      </div>

      {viewingOffer && (
        <OfferDetailModal
          offer={viewingOffer}
          onClose={() => setViewingOffer(null)}
          onApprove={() => { void handleApprove(viewingOffer.id); setViewingOffer(null); }}
          onRequestChanges={() => { setRejectTarget(viewingOffer); setViewingOffer(null); }}
          loading={moderatingOffer === viewingOffer.id}
        />
      )}

      {rejectTarget && (
        <RejectOfferModal
          offer={rejectTarget}
          loading={moderatingOffer === rejectTarget.id}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => void handleReject(rejectTarget.id, reason)}
        />
      )}

      {/* ── Onglet Statistiques ── */}
      {activeTab === "stats" && (
        <>
          {!stats ? (
            <div className="flex justify-center py-16">
              <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Total utilisateurs", value: stats.users.total, icon: <Users className="size-5" />, color: "text-foreground bg-muted" },
                  { label: "Développeurs", value: stats.users.developers, icon: <Code2 className="size-5" />, color: "text-sky-600 bg-sky-500/10" },
                  { label: "Recruteurs", value: stats.users.recruiters, icon: <Briefcase className="size-5" />, color: "text-violet-600 bg-violet-500/10" },
                  { label: "Admins", value: stats.users.admins, icon: <ShieldAlert className="size-5" />, color: "text-amber-600 bg-amber-500/10" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="rounded-2xl border border-border bg-card p-5">
                    <div className={`mb-3 inline-flex size-9 items-center justify-center rounded-lg ${color}`}>{icon}</div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Offres publiées", value: stats.jobOffers.published, icon: <Briefcase className="size-5" />, color: "text-emerald-600 bg-emerald-500/10" },
                  { label: "Candidatures totales", value: stats.applications.total, icon: <FileText className="size-5" />, color: "text-sky-600 bg-sky-500/10" },
                  { label: "Taux d'acceptation", value: `${stats.applications.acceptanceRate}%`, icon: <TrendingUp className="size-5" />, color: "text-violet-600 bg-violet-500/10" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="rounded-2xl border border-border bg-card p-5">
                    <div className={`mb-3 inline-flex size-9 items-center justify-center rounded-lg ${color}`}>{icon}</div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <AdminStatsCharts stats={stats} />
            </>
          )}
        </>
      )}

      {/* ── Onglet Utilisateurs ── */}
      {activeTab === "users" && (<>
      {showCreateForm && (
        <CreateRecruiterModal onClose={() => setShowCreateForm(false)} onSuccess={handleCreated} />
      )}
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSuccess={handleUpdated} />
      )}
      {deletingUser && (
        <DeleteUserModal user={deletingUser} onClose={() => setDeletingUser(null)} onSuccess={handleDeleted} />
      )}

      {/* Table utilisateurs */}
      <div className="rounded-2xl border border-border bg-card">
        {/* Barre de recherche + filtres */}
        <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => { setRoleFilter(f.value); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  roleFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative max-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-base pl-9 text-sm"
              placeholder="Email ou nom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !result || result.data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
        ) : (
          <div className="divide-y divide-border">
            {result.data.map((user) => (
              <div key={user.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{user.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? "bg-muted text-muted-foreground"}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
                  {user.recruiterProfile?.company && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {user.recruiterProfile.company.name}
                      {user.recruiterProfile.company.siret && (
                        <span className="ml-1.5 font-mono text-muted-foreground/70">
                          SIRET {user.recruiterProfile.company.siret}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </span>
                {user.role !== "ADMIN" && (
                  <div className="flex shrink-0 items-center gap-1">
                    {adminId && (
                      <MessageButton
                        developerId={user.role === "DEVELOPER" ? user.id : adminId}
                        recruiterId={user.role === "RECRUITER" ? user.id : adminId}
                        label=""
                        variant="ghost"
                        size="icon"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingUser(user)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Modifier"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingUser(user)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <span className="text-sm text-muted-foreground">
              {result?.total} utilisateurs · page {page}/{totalPages}
            </span>
            <div className="flex gap-1">
              <Button size="icon-sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon-sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      </>)}

      {/* ── Onglet Modération des offres ── */}
      {activeTab === "offers" && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-semibold text-foreground">Offres en attente de validation</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Vérifiez et approuvez ou demandez des modifications sur les offres soumises par les recruteurs.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approuver ne publie pas l&apos;offre : c&apos;est ensuite au recruteur de la rendre visible publiquement quand il le souhaite.
            </p>
          </div>

          {offersLoading ? (
            <div className="flex justify-center py-12">
              <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !pendingOffers || pendingOffers.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CheckCircle2 className="size-10 text-green-500/60" />
              <p className="text-sm font-medium text-foreground">Aucune offre en attente</p>
              <p className="text-xs text-muted-foreground">Toutes les offres soumises ont été traitées.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingOffers.data.map((offer) => (
                <div key={offer.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{offer.title}</span>
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                        {offer.type === "INTERNSHIP" ? "Stage" : offer.type === "APPRENTICESHIP" ? "Alternance" : "Premier emploi"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {offer.companyName ?? "Entreprise inconnue"}
                      {offer.location ? ` · ${offer.location}` : ""}
                      {offer.country ? `, ${offer.country}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      Soumise le {new Date(offer.updatedAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingOffer(offer)}
                    >
                      Voir l&apos;offre
                    </Button>
                    <Button
                      size="sm"
                      disabled={moderatingOffer === offer.id}
                      onClick={() => void handleApprove(offer.id)}
                      title="L'offre ne sera pas publiée automatiquement : le recruteur devra la publier lui-même."
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={moderatingOffer === offer.id}
                      onClick={() => setRejectTarget(offer)}
                      className="text-amber-600 hover:border-amber-500/50 hover:bg-amber-500/10"
                    >
                      <XCircle className="size-3.5" />
                      Demander des modifications
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingOffers && Math.ceil(pendingOffers.total / 10) > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <span className="text-sm text-muted-foreground">
                {pendingOffers.total} offre{pendingOffers.total > 1 ? "s" : ""} · page {offerPage}/{Math.ceil(pendingOffers.total / 10)}
              </span>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="outline" disabled={offerPage <= 1} onClick={() => setOfferPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="icon-sm" variant="outline" disabled={offerPage >= Math.ceil(pendingOffers.total / 10)} onClick={() => setOfferPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Signalements ── */}
      {activeTab === "reports" && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-4">
            {([
              { value: "open", label: "Ouverts" },
              { value: "resolved", label: "Résolus" },
              { value: "dismissed", label: "Rejetés" },
              { value: "ALL", label: "Tous" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setReportPage(1); setReportStatusFilter(value); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${reportStatusFilter === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {reportsLoading ? (
            <div className="flex justify-center py-16">
              <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !reports || reports.data.length === 0 ? (
            <div className="empty-state py-16">
              <Flag className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Aucun signalement</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reports.data.map((report) => (
                <div key={report.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {report.targetType === "profile" ? "Profil" : "Offre"}
                      </span>
                      <Link
                        href={report.targetType === "profile" ? `/developpeurs/${report.targetId}` : `/offres/${report.targetId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Voir la cible
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(report.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{report.reason}</p>
                  </div>
                  {report.status === "open" ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={moderatingReport === report.id}
                        onClick={() => void handleReportStatus(report.id, "dismissed")}
                      >
                        <XCircle className="size-3.5" />
                        Rejeter
                      </Button>
                      <Button
                        size="sm"
                        disabled={moderatingReport === report.id}
                        onClick={() => void handleReportStatus(report.id, "resolved")}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Résoudre
                      </Button>
                    </div>
                  ) : (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${report.status === "resolved" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {report.status === "resolved" ? "Résolu" : "Rejeté"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {reports && Math.ceil(reports.total / 10) > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <span className="text-sm text-muted-foreground">
                {reports.total} signalement{reports.total > 1 ? "s" : ""} · page {reportPage}/{Math.ceil(reports.total / 10)}
              </span>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="outline" disabled={reportPage <= 1} onClick={() => setReportPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="icon-sm" variant="outline" disabled={reportPage >= Math.ceil(reports.total / 10)} onClick={() => setReportPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal création recruteur ──────────────────────────────────────────────────

function CreateRecruiterModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", companyName: "", siret: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleSiretChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Garder uniquement les chiffres, max 14
    const digits = e.target.value.replace(/\D/g, "").slice(0, 14);
    setForm((f) => ({ ...f, siret: digits }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { setError("Mot de passe : 8 caractères minimum"); return; }
    if (form.siret.length !== 14) { setError("SIRET invalide : 14 chiffres requis"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/create-recruiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; emailSent?: boolean; emailError?: string };
      if (!res.ok) { setError(data.error ?? "Erreur inconnue"); return; }
      if (data.emailSent === false) {
        setError(`Compte créé mais l'email de bienvenue n'a pas pu être envoyé (${data.emailError ?? "erreur Resend"}). Transmettez les identifiants manuellement.`);
      }
      onSuccess();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Créer un compte recruteur" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-right text-xs text-muted-foreground"><span className="text-destructive">*</span> Champs obligatoires</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" required><input required className="input-base" value={form.firstName} onChange={set("firstName")} placeholder="Alice" /></Field>
          <Field label="Nom" required><input required className="input-base" value={form.lastName} onChange={set("lastName")} placeholder="Martin" /></Field>
        </div>
        <Field label="Email" required><input required type="email" className="input-base" value={form.email} onChange={set("email")} placeholder="alice@entreprise.com" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entreprise" required><input required className="input-base" value={form.companyName} onChange={set("companyName")} placeholder="Acme SAS" /></Field>
          <Field label="SIRET" required>
            <input
              required
              className="input-base font-mono tracking-wider"
              value={form.siret}
              onChange={handleSiretChange}
              placeholder="14 chiffres"
              inputMode="numeric"
              maxLength={14}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Le SIRET est vérifié automatiquement auprès du registre officiel des entreprises avant la création du compte.
        </p>
        <Field label="Mot de passe temporaire" required>
          <div className="relative">
            <input required type={showPwd ? "text" : "password"} className="input-base pr-10" value={form.password} onChange={set("password")} placeholder="8 caractères minimum" />
            <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Le recruteur peut le changer via "Mot de passe oublié".</p>
        </Field>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Vérification SIRET…" : "Créer le compte"}</Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Annuler</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal édition utilisateur ─────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSuccess }: { user: UserRow; onClose: () => void; onSuccess: (u: UserRow) => void }) {
  const [name, setName] = useState(user.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: string } & Partial<UserRow>;
      if (!res.ok) { setError((data as { error?: string }).error ?? "Erreur"); return; }
      onSuccess({ ...user, name: data.name ?? user.name });
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Modifier l'utilisateur" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-right text-xs text-muted-foreground"><span className="text-destructive">*</span> Champs obligatoires</p>
        <Field label="Nom affiché" required>
          <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Rôle">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? "bg-muted text-muted-foreground"}`}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </Field>
        <p className="text-xs text-muted-foreground">
          Email : <span className="font-mono">{user.email}</span>
        </p>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Enregistrement…" : "Enregistrer"}</Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Annuler</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal suppression utilisateur ─────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onSuccess }: { user: UserRow; onClose: () => void; onSuccess: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erreur");
        return;
      }
      onSuccess(user.id);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Supprimer l'utilisateur" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="text-sm text-foreground">
            <p className="font-medium">Cette action est irréversible.</p>
            <p className="mt-1 text-muted-foreground">
              Le compte de <strong>{user.name}</strong> ({user.email}) et toutes ses données associées seront définitivement supprimés.
            </p>
          </div>
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="destructive" className="flex-1" disabled={loading} onClick={handleDelete}>
            {loading ? "Suppression…" : "Supprimer définitivement"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Annuler</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Modal détail d'une offre ──────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  INTERNSHIP: "Stage",
  APPRENTICESHIP: "Alternance",
  FIRST_JOB: "Premier emploi",
};

const TECH_LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
};

const OFFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente",
  APPROVED: "Approuvée",
  PUBLISHED: "Publiée",
  REJECTED: "Rejetée",
  ARCHIVED: "Archivée",
};

const OFFER_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PENDING_REVIEW: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  APPROVED: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  PUBLISHED: "bg-green-500/10 text-green-700 dark:text-green-400",
  REJECTED: "bg-destructive/10 text-destructive",
  ARCHIVED: "bg-muted text-muted-foreground",
};

const HISTORY_ACTOR_LABELS: Record<string, string> = {
  RECRUITER: "Le recruteur",
  ADMIN: "Vous",
  SYSTEM: "Système",
};

type JobOfferEvent = {
  id: string;
  status: string;
  note: string | null;
  actorRole: "RECRUITER" | "ADMIN" | "SYSTEM";
  actorId: string | null;
  createdAt: string;
};

function OfferHistoryTimeline({ events, loading }: { events: JobOfferEvent[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="size-5 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Aucun historique disponible.
      </p>
    );
  }
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OFFER_STATUS_COLORS[event.status] ?? "bg-muted text-muted-foreground"}`}>
              {OFFER_STATUS_LABELS[event.status] ?? event.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {HISTORY_ACTOR_LABELS[event.actorRole] ?? event.actorRole} · {new Date(event.createdAt).toLocaleString("fr-FR")}
            </span>
          </div>
          {event.note && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground">
              <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              {event.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function OfferDetailModal({
  offer,
  loading,
  onClose,
  onApprove,
  onRequestChanges,
}: {
  offer: PendingOffer;
  loading: boolean;
  onClose: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
}) {
  const [history, setHistory] = useState<JobOfferEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`${apiUrl}/admin/job-offers/${offer.id}/history`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<JobOfferEvent[]>) : []))
      .then((data) => { if (!cancelled) setHistory(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [offer.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground">{offer.title}</h2>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                {JOB_TYPE_LABELS[offer.type] ?? offer.type}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {offer.companyName ?? "Entreprise inconnue"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="space-y-6 px-6 py-5">
          {/* Informations clés */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {(offer.location ?? offer.country) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                {[offer.location, offer.country].filter(Boolean).join(", ")}
              </span>
            )}
            {offer.remoteOk && (
              <span className="flex items-center gap-1.5">
                <Wifi className="size-3.5 shrink-0" />
                Remote OK
              </span>
            )}
            {(offer.salaryMin ?? offer.salaryMax) && (
              <span className="flex items-center gap-1.5">
                <Euro className="size-3.5 shrink-0" />
                {offer.salaryMin && offer.salaryMax
                  ? `${offer.salaryMin.toLocaleString("fr-FR")} – ${offer.salaryMax.toLocaleString("fr-FR")} €`
                  : offer.salaryMin
                  ? `À partir de ${offer.salaryMin.toLocaleString("fr-FR")} €`
                  : `Jusqu'à ${offer.salaryMax!.toLocaleString("fr-FR")} €`}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" />
              Soumise le {new Date(offer.updatedAt).toLocaleDateString("fr-FR")}
            </span>
          </div>

          {/* Description */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {offer.description}
            </div>
          </div>

          {/* Technologies requises */}
          {offer.requiredTechnologies.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Technologies requises
              </p>
              <div className="flex flex-wrap gap-2">
                {offer.requiredTechnologies.map((tech) => {
                  const level = offer.requiredTechLevels?.[tech];
                  return (
                    <span
                      key={tech}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {tech}
                      {level && (
                        <span className="text-muted-foreground">· {TECH_LEVEL_LABELS[level] ?? level}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historique des statuts */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="size-3.5" />
              Historique
            </p>
            <OfferHistoryTimeline events={history} loading={historyLoading} />
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-card px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Fermer
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onRequestChanges}
            className="text-amber-600 hover:border-amber-500/50 hover:bg-amber-500/10"
          >
            <XCircle className="size-4" />
            Demander des modifications
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={onApprove}
            title="L'offre ne sera pas publiée automatiquement : le recruteur devra la publier lui-même."
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="size-4" />
            {loading ? "Approbation…" : "Approuver"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Modal demande de modifications ────────────────────────────────────────────

function RejectOfferModal({
  offer,
  loading,
  onClose,
  onConfirm,
}: {
  offer: PendingOffer;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal title="Demander des modifications" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          L&apos;offre <strong className="text-foreground">&quot;{offer.title}&quot;</strong> sera renvoyée au
          recruteur. Il recevra votre commentaire, pourra apporter les corrections nécessaires et
          resoumettre l&apos;offre pour validation.
        </p>
        <Field label="Commentaire pour le recruteur" required>
          <textarea
            className="input-base min-h-24 resize-y"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : La description est trop vague. Précisez les missions confiées, les prérequis techniques attendus et les conditions de rémunération."
          />
        </Field>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 text-amber-600 hover:border-amber-500/50 hover:bg-amber-500/10"
            disabled={loading || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {loading ? "Envoi…" : "Envoyer au recruteur"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Annuler</Button>
        </div>
      </div>
    </Modal>
  );
}

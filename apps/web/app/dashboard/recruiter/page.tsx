"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Users,
  Bell,
  ArrowRight,
  Plus,
  FileText,
  TrendingUp,
  Send,
  Archive,
  ArchiveRestore,
  Rocket,
  Pencil,
  Trash2,
  Zap,
  AlertTriangle,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";

const FREE_PLAN_LIMIT = 2;

type OfferStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

type JobOffer = {
  id: string;
  title: string;
  type: "INTERNSHIP" | "APPRENTICESHIP" | "FIRST_JOB";
  status: OfferStatus;
  location: string | null;
  remoteOk: boolean;
  createdAt: string;
  rejectionReason?: string | null;
};

type JobOfferEvent = {
  id: string;
  status: OfferStatus;
  note: string | null;
  actorRole: "RECRUITER" | "ADMIN" | "SYSTEM";
  actorId: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<JobOffer["type"], string> = {
  INTERNSHIP: "Stage",
  APPRENTICESHIP: "Alternance",
  FIRST_JOB: "Premier emploi",
};

const STATUS_LABELS: Record<JobOffer["status"], string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente",
  APPROVED: "Approuvée — à publier",
  PUBLISHED: "Publiée",
  REJECTED: "Rejetée",
  ARCHIVED: "Archivée",
};

const STATUS_COLORS: Record<JobOffer["status"], string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PENDING_REVIEW: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  APPROVED: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  PUBLISHED: "bg-green-500/10 text-green-700 dark:text-green-400",
  REJECTED: "bg-destructive/10 text-destructive",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export default function RecruiterDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const firstName = session?.user.name.split(" ")[0] ?? "Recruteur";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [goingLive, setGoingLive] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [unarchiving, setUnarchiving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobOffer | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, JobOfferEvent[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch(`${apiUrl}/job-offers/mine`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<JobOffer[]>) : []))
      .then((data) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [session, apiUrl]);

  async function handlePublish(id: string) {
    setPublishing(id);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updated = (await res.json()) as JobOffer;
        setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
        toast.success("Offre soumise pour validation à l'équipe.");
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(data.message ?? "Erreur lors de la soumission de l'offre.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setPublishing(null);
    }
  }

  async function handleGoLive(id: string) {
    setGoingLive(id);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/go-live`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 402) {
        toast.error("Quota du plan Gratuit atteint. Passez en Pro pour publier davantage.");
        router.push("/plans");
        return;
      }
      if (res.ok) {
        const updated = (await res.json()) as JobOffer;
        setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
        toast.success("Offre publiée et visible publiquement.");
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(data.message ?? "Erreur lors de la publication.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setGoingLive(null);
    }
  }

  async function handleResetToDraft(id: string) {
    setResetting(id);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/reset-to-draft`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: "DRAFT", rejectionReason: null } : o)));
        toast.success("Offre repassée en brouillon.");
      } else {
        toast.error("Erreur lors du passage en brouillon.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setResetting(null);
    }
  }

  async function handleArchive(id: string) {
    setArchiving(id);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: "ARCHIVED" } : o)));
        toast.success("Offre archivée.");
      } else {
        toast.error("Erreur lors de l'archivage.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setArchiving(null);
    }
  }

  async function handleUnarchive(id: string) {
    setUnarchiving(id);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/unarchive`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updated = (await res.json()) as JobOffer;
        setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
        toast.success("Offre désarchivée et repassée en brouillon. Vous pouvez la modifier puis la resoumettre.");
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(data.message ?? "Erreur lors du désarchivage.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setUnarchiving(null);
    }
  }

  async function toggleHistory(id: string) {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(id);
    if (history[id]) return;
    setHistoryLoading(id);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/history`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as JobOfferEvent[];
        setHistory((prev) => ({ ...prev, [id]: data }));
      }
    } finally {
      setHistoryLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(id);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setOffers((prev) => prev.filter((o) => o.id !== id));
        setDeleteTarget(null);
        toast.success("Offre supprimée.");
      } else {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setDeleting(null);
    }
  }

  const activeCount = offers.filter((o) => o.status === "PUBLISHED").length;
  const draftCount = offers.filter((o) => o.status === "DRAFT").length;
  const approvedOffers = offers.filter((o) => o.status === "APPROVED");
  const isAtLimit = !loading && activeCount >= FREE_PLAN_LIMIT;

  function handleNewOffer() {
    if (isAtLimit) {
      router.push("/plans");
    } else {
      router.push("/jobs/new");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* ── Bandeau offres approuvées à publier ─────────────────── */}
      {approvedOffers.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-teal-800 dark:text-teal-400">
              {approvedOffers.length === 1
                ? "Une offre a été approuvée et attend votre publication"
                : `${approvedOffers.length} offres ont été approuvées et attendent votre publication`}
            </p>
            <p className="text-xs text-teal-700/80 dark:text-teal-400/80">
              L&apos;approbation ne publie pas l&apos;offre automatiquement : c&apos;est à vous de la rendre visible quand vous êtes prêt.
            </p>
          </div>
          <Button
            size="sm"
            disabled={goingLive === approvedOffers[0]?.id}
            onClick={() => approvedOffers[0] && void handleGoLive(approvedOffers[0].id)}
            className="shrink-0 bg-teal-600 text-white hover:bg-teal-700"
          >
            <Rocket className="size-3.5" />
            Publier {approvedOffers.length === 1 ? "l'offre" : "la première"}
          </Button>
        </div>
      )}

      {/* ── Bandeau freemium ─────────────────────────────────────── */}
      {isAtLimit && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              Limite du plan Gratuit atteinte ({activeCount}/{FREE_PLAN_LIMIT} offres actives)
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              Archivez une offre ou passez en Pro pour en publier davantage.
            </p>
          </div>
          <Button size="sm" asChild className="shrink-0">
            <Link href="/plans">
              <Zap className="size-3.5" />
              Passer en Pro
            </Link>
          </Button>
        </div>
      )}

      {/* ── Welcome ──────────────────────────────────────────────── */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour, {firstName} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Gérez vos offres et suivez vos candidatures.
          </p>
        </div>
        <Button size="sm" onClick={handleNewOffer}>
          <Plus className="size-4" />
          {isAtLimit ? "Voir les plans" : "Nouvelle offre"}
        </Button>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Offres actives",
            value: loading ? "…" : `${activeCount}/${FREE_PLAN_LIMIT}`,
            icon: <Briefcase className="size-5" />,
            color: isAtLimit ? "text-amber-600 bg-amber-500/10" : "text-primary bg-primary/10",
          },
          {
            label: "Brouillons",
            value: loading ? "…" : draftCount.toString(),
            icon: <FileText className="size-5" />,
            color: "text-violet-600 bg-violet-500/10",
          },
          {
            label: "Profils matchés",
            value: "—",
            icon: <Users className="size-5" />,
            color: "text-emerald-600 bg-emerald-500/10",
          },
          {
            label: "Messages non lus",
            value: "0",
            icon: <Bell className="size-5" />,
            color: "text-amber-600 bg-amber-500/10",
          },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
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
        {/* Mes offres */}
        <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Mes offres</h2>
            <Button size="sm" variant="outline" onClick={handleNewOffer}>
              <Plus className="size-3.5" />
              {isAtLimit ? "Voir les plans" : "Nouvelle offre"}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : offers.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-8" />}
              title="Aucune offre publiée"
              description="Publiez votre première offre de stage, alternance ou premier emploi."
              action={
                <Button size="sm" onClick={handleNewOffer}>
                  {isAtLimit ? "Voir les plans" : "Créer une offre"}
                  <ArrowRight className="size-3.5" />
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {offers.map((offer) => (
                <div key={offer.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/jobs/${offer.id}/edit`}
                          className="truncate text-sm font-medium text-foreground hover:text-primary"
                        >
                          {offer.title}
                        </Link>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[offer.status]}`}>
                          {STATUS_LABELS[offer.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {TYPE_LABELS[offer.type]}
                        {offer.location ? ` · ${offer.location}` : ""}
                        {offer.remoteOk ? " · Remote" : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void toggleHistory(offer.id)}
                        title="Historique des statuts"
                        className="text-muted-foreground"
                      >
                        <History className="size-3.5" />
                        Historique
                        {expandedHistoryId === offer.id ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </Button>
                      {offer.status === "PUBLISHED" ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled
                          title="Archivez l'offre pour pouvoir la modifier"
                          className="text-muted-foreground/40"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : (
                        <Button size="icon-sm" variant="ghost" asChild title="Modifier">
                          <Link href={`/jobs/${offer.id}/edit`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                      )}
                      {(offer.status === "DRAFT" || offer.status === "REJECTED") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={publishing === offer.id}
                          onClick={() => void handlePublish(offer.id)}
                          title="Soumettre"
                        >
                          <Send className="size-3.5" />
                          {publishing === offer.id ? "…" : "Soumettre"}
                        </Button>
                      )}
                      {offer.status === "REJECTED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={resetting === offer.id}
                          onClick={() => void handleResetToDraft(offer.id)}
                          title="Repasser en brouillon"
                          className="text-muted-foreground"
                        >
                          {resetting === offer.id ? "…" : "Brouillon"}
                        </Button>
                      )}
                      {offer.status === "APPROVED" && (
                        <Button
                          size="sm"
                          disabled={goingLive === offer.id}
                          onClick={() => void handleGoLive(offer.id)}
                          title="Publier"
                          className="bg-teal-600 text-white hover:bg-teal-700"
                        >
                          <Rocket className="size-3.5" />
                          {goingLive === offer.id ? "…" : "Publier"}
                        </Button>
                      )}
                      {offer.status === "PUBLISHED" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={archiving === offer.id}
                          onClick={() => void handleArchive(offer.id)}
                          title="Archiver"
                          className="text-muted-foreground"
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      )}
                      {offer.status === "ARCHIVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unarchiving === offer.id}
                          onClick={() => void handleUnarchive(offer.id)}
                          title="Remettre en brouillon"
                        >
                          <ArchiveRestore className="size-3.5" />
                          {unarchiving === offer.id ? "…" : "Désarchiver"}
                        </Button>
                      )}
                      {(offer.status === "DRAFT" || offer.status === "ARCHIVED" || offer.status === "REJECTED") && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={deleting === offer.id}
                          onClick={() => setDeleteTarget(offer)}
                          title="Supprimer"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {offer.status === "REJECTED" && offer.rejectionReason && (
                    <p className="mt-1 text-xs text-destructive">
                      Motif : {offer.rejectionReason}
                    </p>
                  )}
                  {expandedHistoryId === offer.id && (
                    <OfferHistoryTimeline
                      events={history[offer.id]}
                      loading={historyLoading === offer.id}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Candidatures récentes */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Candidatures récentes</h2>
            <Link href="/applications" className="text-xs text-primary hover:underline">
              Voir tout
            </Link>
          </div>
          <EmptyState
            icon={<FileText className="size-8" />}
            title="Aucune candidature"
            description="Les candidatures apparaîtront ici dès que vous aurez une offre active."
          />
        </div>

        {/* Profils recommandés */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Profils recommandés</h2>
            <Link href="/developpeurs" className="text-xs text-primary hover:underline">
              Explorer
            </Link>
          </div>
          <EmptyState
            icon={<TrendingUp className="size-8" />}
            title="Publiez une offre pour voir les profils"
            description="Notre algorithme de matching vous suggère les meilleurs profils selon votre stack."
            action={
              activeCount === 0 ? (
                <Button asChild size="sm">
                  <Link href="/jobs/new">
                    Créer une offre <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Supprimer cette offre ?"
          description={`"${deleteTarget.title}" sera supprimée définitivement. Cette action est irréversible.`}
          confirmLabel="Supprimer l'offre"
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={deleting === deleteTarget.id}
        />
      )}
    </div>
  );
}

const HISTORY_ACTOR_LABELS: Record<JobOfferEvent["actorRole"], string> = {
  RECRUITER: "Vous",
  ADMIN: "L'équipe",
  SYSTEM: "Système",
};

function OfferHistoryTimeline({
  events,
  loading,
}: {
  events: JobOfferEvent[] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-3 flex justify-center py-4">
        <div className="size-5 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!events || events.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Aucun historique disponible.
      </p>
    );
  }
  return (
    <ol className="mt-3 space-y-3 border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status]}`}>
              {STATUS_LABELS[event.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {HISTORY_ACTOR_LABELS[event.actorRole]} · {new Date(event.createdAt).toLocaleString("fr-FR")}
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
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <div className="mb-3 text-muted-foreground/50">{icon}</div>
      <p className="mb-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

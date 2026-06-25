"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { ArrowLeft, CheckCircle2, Send, Archive, Trash2, ChevronDown, UserCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobOfferForm, type JobOfferFormData } from "../../job-offer-form";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { toast } from "sonner";
import {
  ApplicationEventTimeline,
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  InterviewBanner,
  type ApplicationEvent,
  type ApplicationStatus,
  type InterviewMode,
} from "@/components/application-event-timeline";
import { DocumentRequestsPanel } from "@/components/document-requests";
import { MessageButton } from "@/components/message-button";

type JobOffer = {
  id: string;
  title: string;
  description: string;
  type: "INTERNSHIP" | "APPRENTICESHIP" | "FIRST_JOB";
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  isPublic: boolean;
  location: string | null;
  remoteOk: boolean;
  requiredTechnologies: string[];
  requiredTechLevels: Record<string, string> | null;
  salaryMin: number | null;
  salaryMax: number | null;
  rejectionReason?: string | null;
};

const STATUS_LABELS: Record<JobOffer["status"], string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente de validation",
  PUBLISHED: "Publiée",
  REJECTED: "Rejetée",
  ARCHIVED: "Archivée",
};

const STATUS_COLORS: Record<JobOffer["status"], string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PENDING_REVIEW: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PUBLISHED: "bg-green-500/10 text-green-700 dark:text-green-400",
  REJECTED: "bg-destructive/10 text-destructive",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export default function EditJobOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const highlightApplicationId = searchParams.get("applicationId");

  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tab, setTab] = useState<"details" | "applications">(
    searchParams.get("tab") === "applications" ? "applications" : "details",
  );

  useEffect(() => {
    if (!session) return;

    fetch(`${apiUrl}/job-offers/${id}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Offre introuvable");
        return res.json() as Promise<JobOffer>;
      })
      .then(setOffer)
      .catch(() => router.push("/dashboard/recruiter"))
      .finally(() => setLoading(false));
  }, [session, id, apiUrl, router]);

  async function handleSave(form: JobOfferFormData) {
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      location: form.location.trim() || undefined,
      country: form.country.trim() || undefined,
      remoteOk: form.remoteOk,
      requiredTechnologies: form.requiredTechnologies,
      requiredTechLevels: Object.keys(form.requiredTechLevels).length > 0 ? form.requiredTechLevels : undefined,
      salaryMin: form.salaryMin ? parseInt(form.salaryMin, 10) : undefined,
      salaryMax: form.salaryMax ? parseInt(form.salaryMax, 10) : undefined,
      isPublic: form.isPublic,
    };

    const res = await fetch(`${apiUrl}/job-offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = (await res.json()) as {
        message?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      };
      if (typeof data.message === 'object' && data.message !== null) {
        const fieldErrors = data.message.fieldErrors ?? {};
        const msgs = Object.entries(fieldErrors)
          .map(([field, errs]) => `${field} : ${errs.join(', ')}`)
          .join(' — ');
        throw new Error(msgs || data.message.formErrors?.join(', ') || "Données invalides");
      }
      throw new Error(typeof data.message === 'string' ? data.message : "Erreur lors de la mise à jour");
    }

    const updated = (await res.json()) as JobOffer;
    setOffer(updated);
    toast.success("Offre mise à jour");
  }

  async function handlePublish() {
    setActing(true);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        if (res.status === 402) {
          router.push("/plans");
          return;
        }
        toast.error("Impossible de publier", { description: data.message ?? "Erreur" });
        return;
      }
      const updated = (await res.json()) as JobOffer;
      setOffer(updated);
      toast.success("Offre publiée !");
    } finally {
      setActing(false);
    }
  }

  async function handleArchive() {
    setActing(true);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error("Impossible d'archiver", { description: data.message ?? "Erreur" });
        return;
      }
      const updated = (await res.json()) as JobOffer;
      setOffer(updated);
      toast.success("Offre archivée");
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    setActing(true);
    try {
      const res = await fetch(`${apiUrl}/job-offers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error("Impossible de supprimer", { description: data.message ?? "Erreur" });
        setShowDeleteModal(false);
        return;
      }
      toast.success("Offre supprimée");
      router.push("/dashboard/recruiter");
    } finally {
      setActing(false);
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!offer) return null;

  const initial: Partial<JobOfferFormData> = {
    title: offer.title,
    description: offer.description,
    type: offer.type,
    location: offer.location ?? "",
    remoteOk: offer.remoteOk,
    requiredTechnologies: offer.requiredTechnologies,
    requiredTechLevels: (offer.requiredTechLevels as Record<string, import("../../job-technologies-selector").TechLevel> | null) ?? {},
    salaryMin: offer.salaryMin?.toString() ?? "",
    salaryMax: offer.salaryMax?.toString() ?? "",
    isPublic: offer.isPublic,
  };

  const isArchived = offer.status === "ARCHIVED";
  const isReadOnly = offer.status === "ARCHIVED" || offer.status === "PENDING_REVIEW";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/dashboard/recruiter"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </div>

        {/* Header avec statut */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-foreground">Modifier l&apos;offre</h1>
            <p className="text-sm text-muted-foreground">{offer.title}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[offer.status]}`}>
            {STATUS_LABELS[offer.status]}
          </span>
        </div>

        <Link
          href={`/developpeurs?jobOfferId=${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Search className="size-3.5" />
          Rechercher des profils pour cette offre
        </Link>

        {/* Onglets */}
        <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab("details")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${tab === "details" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Détails
          </button>
          <button
            type="button"
            onClick={() => setTab("applications")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${tab === "applications" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Candidatures
          </button>
        </div>

        {tab === "details" ? (
          <>
            {/* Actions de statut */}
            <div className="mb-6 flex flex-wrap items-start gap-2">
              {(offer.status === "DRAFT" || offer.status === "REJECTED") && (
                <Button size="sm" onClick={() => void handlePublish()} disabled={acting}>
                  <Send className="size-3.5" />
                  {acting ? "Envoi…" : "Soumettre"}
                </Button>
              )}
              {!isArchived && offer.status !== "PENDING_REVIEW" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleArchive()}
                  disabled={acting}
                  className="text-muted-foreground"
                >
                  <Archive className="size-3.5" />
                  Archiver
                </Button>
              )}
              {(offer.status === "DRAFT" || offer.status === "ARCHIVED") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={acting}
                  className="text-destructive hover:border-destructive/50 hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  Supprimer
                </Button>
              )}
            </div>

            {offer.status === "PUBLISHED" && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="size-4 shrink-0" />
                Cette offre est publiée et visible par les développeurs.
              </div>
            )}
            {offer.status === "PENDING_REVIEW" && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
                <CheckCircle2 className="size-4 shrink-0" />
                Offre en cours de validation. Les modifications sont désactivées jusqu&apos;à la décision de l&apos;admin.
              </div>
            )}
            {offer.status === "REJECTED" && offer.rejectionReason && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <span className="font-medium">Motif du rejet :</span> {offer.rejectionReason}
              </div>
            )}
            {isArchived && (
              <div className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                Cette offre est archivée. Les modifications sont désactivées.
              </div>
            )}

            <div className="card p-6">
              <JobOfferForm
                initial={initial}
                onSave={handleSave}
                onCancel={() => router.push("/dashboard/recruiter")}
                submitLabel="Enregistrer les modifications"
                disabled={isReadOnly}
              />
            </div>
          </>
        ) : (
          <ApplicationsTab
            jobOfferId={id}
            apiUrl={apiUrl}
            highlightApplicationId={highlightApplicationId}
            recruiterId={(session?.user as { id?: string } | undefined)?.id}
          />
        )}
      </main>

      {showDeleteModal && (
        <ConfirmDeleteModal
          title="Supprimer cette offre ?"
          description={`"${offer.title}" sera supprimée définitivement. Cette action est irréversible.`}
          confirmLabel="Supprimer l'offre"
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
          loading={acting}
        />
      )}
    </div>
  );
}

type CandidateApplication = {
  id: string;
  developerId: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  createdAt: string;
  interviewMode: InterviewMode | null;
  interviewLocation: string | null;
};

type DeveloperSummary = {
  firstName: string;
  lastName: string;
  title: string | null;
  avatarUrl: string | null;
};

const RECRUITER_TARGET_STATUSES: ApplicationStatus[] = [
  "VIEWED",
  "INTERVIEW",
  "ACCEPTED",
  "REJECTED",
];
const APPLICATION_TERMINAL_STATUSES: ApplicationStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

function ApplicationsTab({
  jobOfferId,
  apiUrl,
  highlightApplicationId,
  recruiterId,
}: {
  jobOfferId: string;
  apiUrl: string;
  highlightApplicationId: string | null;
  recruiterId: string | undefined;
}) {
  const [applications, setApplications] = useState<CandidateApplication[] | null>(null);
  const [developers, setDevelopers] = useState<Record<string, DeveloperSummary>>({});

  useEffect(() => {
    fetch(`${apiUrl}/applications/job-offer/${jobOfferId}`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<CandidateApplication[]>) : []))
      .then(async (apps) => {
        setApplications(apps);
        const fetched = await Promise.all(
          apps.map((a) =>
            fetch(`${apiUrl}/users/developer/${a.developerId}`, { credentials: "include" })
              .then((r) => (r.ok ? (r.json() as Promise<DeveloperSummary>) : null))
              .catch(() => null),
          ),
        );
        const map: Record<string, DeveloperSummary> = {};
        apps.forEach((a, i) => {
          const dev = fetched[i];
          if (dev) map[a.developerId] = dev;
        });
        setDevelopers(map);
      })
      .catch(() => setApplications([]));
  }, [apiUrl, jobOfferId]);

  function handleUpdate(updated: CandidateApplication) {
    setApplications((prev) =>
      prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev,
    );
  }

  if (applications === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="empty-state">
        <UserCircle2 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <p className="mb-1 text-sm font-medium text-foreground">
          Aucune candidature pour le moment
        </p>
        <p className="text-xs text-muted-foreground">
          Les candidatures reçues pour cette offre apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <CandidateCard
          key={application.id}
          application={application}
          developer={developers[application.developerId]}
          apiUrl={apiUrl}
          onUpdate={handleUpdate}
          highlighted={application.id === highlightApplicationId}
          recruiterId={recruiterId}
          jobOfferId={jobOfferId}
        />
      ))}
    </div>
  );
}

function CandidateCard({
  application,
  developer,
  apiUrl,
  onUpdate,
  highlighted = false,
  recruiterId,
  jobOfferId,
}: {
  application: CandidateApplication;
  developer: DeveloperSummary | undefined;
  apiUrl: string;
  onUpdate: (updated: CandidateApplication) => void;
  highlighted?: boolean;
  recruiterId: string | undefined;
  jobOfferId: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardExpanded, setCardExpanded] = useState(highlighted);
  // Surbrillance temporaire : sans ça, le cadre reste affiché indéfiniment
  // tant que le paramètre `applicationId` traîne dans l'URL (gênant dès
  // qu'on commence à interagir avec la carte, ex. changer le statut).
  const [showHighlight, setShowHighlight] = useState(highlighted);

  useEffect(() => {
    if (!highlighted) return;
    cardRef.current?.scrollIntoView({ block: "center" });
    const timeout = setTimeout(() => setShowHighlight(false), 2500);
    return () => clearTimeout(timeout);
    // Ne s'exécute qu'au montage : on ne veut re-scroller/déplier que lors de
    // l'arrivée depuis le lien du dashboard, pas à chaque re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<ApplicationEvent[] | undefined>(undefined);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>(
    RECRUITER_TARGET_STATUSES.includes(application.status)
      ? application.status
      : "VIEWED",
  );
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>(
    application.interviewMode ?? "REMOTE",
  );
  const [interviewLocation, setInterviewLocation] = useState(
    application.interviewLocation ?? "",
  );

  const isTerminal = APPLICATION_TERMINAL_STATUSES.includes(application.status);
  const createdAt = new Date(application.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const availableTargetStatuses = RECRUITER_TARGET_STATUSES.filter(
    (s) => s !== "ACCEPTED" || application.status === "INTERVIEW",
  );

  function generateJitsiLink() {
    const slug = `adopte-ton-dev-${application.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
    setInterviewLocation(`https://meet.jit.si/${slug}`);
  }

  function toggleExpanded() {
    setExpanded((e) => !e);
    if (!events && !loadingEvents) {
      setLoadingEvents(true);
      fetch(`${apiUrl}/applications/${application.id}/history`, {
        credentials: "include",
      })
        .then((res) => (res.ok ? (res.json() as Promise<ApplicationEvent[]>) : []))
        .then(setEvents)
        .finally(() => setLoadingEvents(false));
    }
  }

  async function handleStatusChange() {
    if (nextStatus === application.status) return;
    setUpdating(true);
    try {
      const res = await fetch(`${apiUrl}/applications/${application.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          note: note.trim() || undefined,
          ...(nextStatus === "INTERVIEW" && {
            interviewMode,
            interviewLocation: interviewLocation.trim() || undefined,
          }),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error("Impossible de mettre à jour le statut", {
          description: data.message,
        });
        return;
      }
      const updated = (await res.json()) as CandidateApplication;
      onUpdate(updated);
      setNote("");
      toast.success("Statut mis à jour");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      ref={cardRef}
      className={`card p-5 transition-shadow duration-700 ${showHighlight ? "ring-2 ring-primary" : ""}`}
    >
      <button
        type="button"
        onClick={() => setCardExpanded((e) => !e)}
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserCircle2 className="size-6" />
          </div>
          <div>
            <span className="font-semibold text-foreground">
              {developer ? `${developer.firstName} ${developer.lastName}` : "Candidat"}
            </span>
            {developer?.title && (
              <p className="text-xs text-muted-foreground">{developer.title}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              Candidature reçue le {createdAt}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${APPLICATION_STATUS_COLORS[application.status]}`}
          >
            {APPLICATION_STATUS_LABELS[application.status]}
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${cardExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {cardExpanded && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/developpeurs/${application.developerId}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Voir le profil complet
            </Link>
            {recruiterId && (
              <MessageButton
                developerId={application.developerId}
                recruiterId={recruiterId}
                jobOfferId={jobOfferId}
                size="sm"
              />
            )}
          </div>

          {application.coverLetter && (
            <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground/90">
              {application.coverLetter}
            </p>
          )}

          {application.status === "INTERVIEW" && (
            <InterviewBanner
              mode={application.interviewMode}
              location={application.interviewLocation}
            />
          )}

          {!isTerminal && (
            <div className="mt-4">
              {application.status !== "INTERVIEW" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  « Acceptée » devient disponible après un entretien.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Changer le statut
                </label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}
                  className="input-base"
                >
                  {availableTargetStatuses.map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px] flex-[2]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Note (optionnel)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Commentaire visible par le candidat"
                  className="input-base"
                />
              </div>

              {nextStatus === "INTERVIEW" && (
                <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="min-w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Format de l&apos;entretien
                    </label>
                    <select
                      value={interviewMode}
                      onChange={(e) => setInterviewMode(e.target.value as InterviewMode)}
                      className="input-base"
                    >
                      <option value="REMOTE">Distanciel (visio)</option>
                      <option value="IN_PERSON">Présentiel</option>
                    </select>
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {interviewMode === "REMOTE" ? "Lien de visio" : "Adresse"}
                    </label>
                    <input
                      type="text"
                      value={interviewLocation}
                      onChange={(e) => setInterviewLocation(e.target.value)}
                      placeholder={
                        interviewMode === "REMOTE"
                          ? "https://meet.jit.si/…"
                          : "12 rue des Lilas, 75011 Paris"
                      }
                      className="input-base"
                    />
                  </div>
                  {interviewMode === "REMOTE" && (
                    <Button type="button" size="sm" variant="outline" onClick={generateJitsiLink}>
                      Générer un lien Jitsi Meet
                    </Button>
                  )}
                </div>
              )}

              <Button
                size="sm"
                onClick={() => void handleStatusChange()}
                disabled={updating || nextStatus === application.status}
              >
                {updating ? "…" : "Mettre à jour"}
              </Button>
              </div>
            </div>
          )}

          <DocumentRequestsPanel
            applicationId={application.id}
            apiUrl={apiUrl}
            role="RECRUITER"
            readOnly={isTerminal}
          />

          <button
            type="button"
            onClick={toggleExpanded}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Masquer l'historique" : "Voir l'historique"}
          </button>

          {expanded && (
            <ApplicationEventTimeline
              events={events}
              loading={loadingEvents}
              viewerRole="RECRUITER"
            />
          )}
        </div>
      )}
    </div>
  );
}

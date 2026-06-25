"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/section-header";
import { MessageButton } from "@/components/message-button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Briefcase, Building2, ChevronDown, ArrowRight } from "lucide-react";

type Application = {
  id: string;
  jobOfferId: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  createdAt: string;
  interviewMode: InterviewMode | null;
  interviewLocation: string | null;
};

type JobOfferSummary = {
  id: string;
  title: string;
  companyName: string | null;
  recruiterId: string;
};

const TERMINAL_STATUSES: ApplicationStatus[] = ["ACCEPTED", "REJECTED", "WITHDRAWN"];

export default function MyApplicationsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const { data: session } = useSession();
  const developerId = (session?.user as { id?: string } | undefined)?.id;
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [offers, setOffers] = useState<Record<string, JobOfferSummary>>({});

  useEffect(() => {
    fetch(`${apiUrl}/applications/mine`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<Application[]>) : []))
      .then(async (apps) => {
        setApplications(apps);
        const uniqueIds = Array.from(new Set(apps.map((a) => a.jobOfferId)));
        const fetched = await Promise.all(
          uniqueIds.map((id) =>
            fetch(`${apiUrl}/job-offers/${id}`)
              .then((r) => (r.ok ? (r.json() as Promise<JobOfferSummary>) : null))
              .catch(() => null),
          ),
        );
        const map: Record<string, JobOfferSummary> = {};
        fetched.forEach((o) => {
          if (o) map[o.id] = o;
        });
        setOffers(map);
      })
      .catch(() => setApplications([]));
  }, [apiUrl]);

  function handleUpdate(updated: Application) {
    setApplications((prev) =>
      prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev,
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="page-container max-w-3xl">
          <SectionHeader title="Mes candidatures" />

          {applications === null ? (
            <div className="flex justify-center py-12">
              <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : applications.length === 0 ? (
            <div className="empty-state">
              <Briefcase className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="mb-1 text-sm font-medium text-foreground">
                Pas encore de candidature
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                Explore les offres et candidate en un clic.
              </p>
              <Button asChild size="sm">
                <Link href="/offres">
                  Explorer les offres <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  offer={offers[application.jobOfferId]}
                  apiUrl={apiUrl}
                  onUpdate={handleUpdate}
                  developerId={developerId}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ApplicationCard({
  application,
  offer,
  apiUrl,
  onUpdate,
  developerId,
}: {
  application: Application;
  offer: JobOfferSummary | undefined;
  apiUrl: string;
  onUpdate: (updated: Application) => void;
  developerId: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<ApplicationEvent[] | undefined>(undefined);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const isTerminal = TERMINAL_STATUSES.includes(application.status);
  const createdAt = new Date(application.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      const res = await fetch(`${apiUrl}/applications/${application.id}/withdraw`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Impossible de retirer la candidature");
        return;
      }
      const updated = (await res.json()) as Application;
      onUpdate(updated);
      toast.success("Candidature retirée");
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleReactivate() {
    setReactivating(true);
    try {
      const res = await fetch(`${apiUrl}/applications/${application.id}/reactivate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(body.message ?? "Impossible de réactiver la candidature");
        return;
      }
      const updated = (await res.json()) as Application;
      onUpdate(updated);
      toast.success("Candidature réactivée");
    } finally {
      setReactivating(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/offres/${application.jobOfferId}`}
            className="font-semibold text-foreground hover:underline"
          >
            {offer?.title ?? "Offre"}
          </Link>
          {offer?.companyName && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="size-3.5" /> {offer.companyName}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Candidature envoyée le {createdAt}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${APPLICATION_STATUS_COLORS[application.status]}`}
        >
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      {application.status === "INTERVIEW" && (
        <InterviewBanner mode={application.interviewMode} location={application.interviewLocation} />
      )}

      <DocumentRequestsPanel
        applicationId={application.id}
        apiUrl={apiUrl}
        role="DEVELOPER"
        readOnly={isTerminal}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Masquer l'historique" : "Voir l'historique"}
        </button>
        {developerId && offer?.recruiterId && (
          <MessageButton
            developerId={developerId}
            recruiterId={offer.recruiterId}
            jobOfferId={application.jobOfferId}
          />
        )}
        {!isTerminal && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={withdrawing}>
                {withdrawing ? "Retrait…" : "Retirer ma candidature"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Retirer cette candidature ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tu pourras la réactiver plus tard si tu changes d'avis, tant
                  que l'offre reste publiée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleWithdraw()}>
                  Retirer ma candidature
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {application.status === "WITHDRAWN" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleReactivate()}
            disabled={reactivating}
          >
            {reactivating ? "Réactivation…" : "Réactiver ma candidature"}
          </Button>
        )}
      </div>

      {expanded && (
        <ApplicationEventTimeline
          events={events}
          loading={loadingEvents}
          viewerRole="DEVELOPER"
        />
      )}
    </div>
  );
}

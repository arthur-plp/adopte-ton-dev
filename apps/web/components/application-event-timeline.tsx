import { Calendar, MapPin, MessageSquare, Video } from "lucide-react";

export type ApplicationStatus =
  | "SENT"
  | "VIEWED"
  | "INTERVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

export type InterviewMode = "REMOTE" | "IN_PERSON";

export type ApplicationEvent = {
  id: string;
  status: ApplicationStatus;
  note: string | null;
  actorRole: "DEVELOPER" | "RECRUITER";
  actorId: string | null;
  createdAt: string;
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SENT: "Envoyée",
  VIEWED: "Vue",
  INTERVIEW: "Entretien",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  WITHDRAWN: "Retirée",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  SENT: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  VIEWED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  INTERVIEW: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  ACCEPTED: "bg-green-500/10 text-green-700 dark:text-green-400",
  REJECTED: "bg-destructive/10 text-destructive",
  WITHDRAWN: "bg-muted text-muted-foreground",
};

export function ApplicationEventTimeline({
  events,
  loading,
  viewerRole,
}: {
  events: ApplicationEvent[] | undefined;
  loading: boolean;
  viewerRole: "DEVELOPER" | "RECRUITER";
}) {
  const actorLabels: Record<"DEVELOPER" | "RECRUITER", string> =
    viewerRole === "DEVELOPER"
      ? { DEVELOPER: "Vous", RECRUITER: "Le recruteur" }
      : { DEVELOPER: "Le candidat", RECRUITER: "Vous" };

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
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${APPLICATION_STATUS_COLORS[event.status]}`}
            >
              {APPLICATION_STATUS_LABELS[event.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {actorLabels[event.actorRole]} ·{" "}
              {new Date(event.createdAt).toLocaleString("fr-FR")}
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

export function InterviewBanner({
  mode,
  location,
}: {
  mode: InterviewMode | null | undefined;
  location: string | null | undefined;
}) {
  if (!mode) return null;
  const isRemote = mode === "REMOTE";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-sm">
      <Calendar className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
      <span className="font-medium text-foreground">
        Entretien {isRemote ? "en distanciel" : "en présentiel"}
      </span>
      {location &&
        (isRemote ? (
          <a
            href={location}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <Video className="size-3.5" /> Rejoindre la visio
          </a>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="size-3.5" /> {location}
          </span>
        ))}
    </div>
  );
}

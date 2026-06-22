"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { ArrowLeft, CheckCircle2, Send, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobOfferForm, type JobOfferFormData } from "../../job-offer-form";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { toast } from "sonner";

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

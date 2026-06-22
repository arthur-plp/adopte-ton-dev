"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";
import { ArrowLeft } from "lucide-react";
import { JobOfferForm, type JobOfferFormData } from "../job-offer-form";
import { toast } from "sonner";

export default function NewJobOfferPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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

    const res = await fetch(`${apiUrl}/job-offers`, {
      method: "POST",
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
      throw new Error(typeof data.message === 'string' ? data.message : "Erreur lors de la création");
    }

    const offer = (await res.json()) as { id: string };
    toast.success("Offre créée", { description: "Votre offre a été créée en brouillon." });
    router.push(`/jobs/${offer.id}/edit`);
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col">
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
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/dashboard/recruiter"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour au tableau de bord
          </Link>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">Nouvelle offre</h1>
        <p className="mb-4 text-muted-foreground">
          Créez votre offre en brouillon, puis soumettez-la pour validation.
        </p>
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
          <svg className="mt-0.5 size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Toute offre soumise est <strong>vérifiée par notre équipe</strong>{" "}avant d&apos;être visible par les développeurs.
            Une fois validée, elle apparaîtra publiquement sur la plateforme.
          </span>
        </div>

        <div className="card p-6">
          <JobOfferForm
            onSave={handleSave}
            onCancel={() => router.push("/dashboard/recruiter")}
            submitLabel="Créer l'offre"
          />
        </div>
      </main>
    </div>
  );
}

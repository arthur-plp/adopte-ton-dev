"use client";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Bell,
  ArrowRight,
  Plus,
  FileText,
  TrendingUp,
} from "lucide-react";

export default function RecruiterDashboard() {
  const { data: session } = useSession();
  const firstName = session?.user.name.split(" ")[0] ?? "Recruteur";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
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
        <Button asChild size="sm">
          <Link href="/jobs/new">
            <Plus className="size-4" />
            Publier une offre
          </Link>
        </Button>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Offres actives",
            value: "0",
            icon: <Briefcase className="size-5" />,
            color: "text-primary bg-primary/10",
          },
          {
            label: "Candidatures reçues",
            value: "0",
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
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Mes offres</h2>
            <Button size="sm" variant="outline" asChild>
              <Link href="/jobs/new">
                <Plus className="size-3.5" /> Nouvelle offre
              </Link>
            </Button>
          </div>
          <EmptyState
            icon={<Briefcase className="size-8" />}
            title="Aucune offre publiée"
            description="Publiez votre première offre de stage, alternance ou premier emploi."
            action={
              <Button asChild size="sm">
                <Link href="/jobs/new">
                  Créer une offre <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
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
        <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Profils recommandés</h2>
            <Link href="/developers" className="text-xs text-primary hover:underline">
              Explorer
            </Link>
          </div>
          <EmptyState
            icon={<TrendingUp className="size-8" />}
            title="Publiez une offre pour voir les profils correspondants"
            description="Notre algorithme de matching vous suggère les meilleurs profils selon votre stack."
            action={
              <Button asChild size="sm">
                <Link href="/jobs/new">
                  Créer une offre <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    </div>
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

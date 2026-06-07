import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import {
  Code2,
  Briefcase,
  Sparkles,
  ArrowRight,
  GitBranch,
  Star,
  Users,
  Zap,
  CheckCircle2,
  Target,
  Clock,
  Filter,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.85_0.08_264/30%),transparent)]"
          />
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Sparkles className="size-3.5" />
              Recrutement centré sur les compétences réelles
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Trouve ton premier poste{" "}
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                dev
              </span>{" "}
              sans 5 ans d&apos;expérience
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Adopte Ton Dev met en relation les développeurs juniors avec des
              recruteurs qui savent que le potentiel ne s&apos;achète pas.
              Montre ce que tu sais faire — pas juste ton CV.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="h-11 px-6 text-base">
                <Link href="/sign-in">
                  <GitBranch className="size-4" />
                  Créer mon profil dev
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 px-6 text-base"
              >
                <Link href="#recruteurs">
                  Je suis recruteur
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              Gratuit pour les développeurs · Aucune carte bancaire
            </p>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <section className="border-y border-border/60 bg-muted/30 py-10">
          <div className="mx-auto grid max-w-4xl grid-cols-3 gap-8 px-4 text-center sm:px-6">
            {[
              { value: "100 %", label: "Gratuit pour les devs" },
              { value: "< 48 h", label: "Délai moyen de réponse" },
              { value: "0 CV requis", label: "Seules tes compétences comptent" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Fonctionnalités ────────────────────────────────────── */}
        <section id="fonctionnalites" className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Conçu pour les deux côtés de la table
              </h2>
              <p className="mt-4 text-muted-foreground">
                Que tu cherches ton premier job ou le prochain développeur de ton équipe.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-md">
                <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Code2 className="size-6" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">Développeurs juniors</h3>
                <p className="mb-6 text-muted-foreground">
                  Crée un profil qui valorise tes projets, tes technos et tes
                  contributions open-source. Laisse ton code parler.
                </p>
                <ul className="space-y-3 text-sm">
                  {[
                    "Profil centré sur tes compétences",
                    "Portfolio de projets GitHub synchronisé",
                    "Visibilité auprès de recruteurs qualifiés",
                    "Notifications dès qu'une offre te correspond",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-md">
                <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                  <Briefcase className="size-6" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">Recruteurs</h3>
                <p className="mb-6 text-muted-foreground">
                  Publie des offres de stage, alternance ou premier emploi.
                  Trouve des talents qui ont déjà prouvé leur valeur en pratique.
                </p>
                <ul className="space-y-3 text-sm">
                  {[
                    "Filtrage avancé par stack technologique",
                    "Score de matching automatique",
                    "Messagerie directe avec les candidats",
                    "Tableau de bord des candidatures",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-4 shrink-0 text-violet-600" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comment ça marche ──────────────────────────────────── */}
        <section id="comment-ca-marche" className="bg-muted/30 py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                En 3 étapes
              </h2>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              {[
                {
                  icon: <GitBranch className="size-6" />,
                  step: "01",
                  title: "Connecte-toi",
                  description:
                    "Utilise ton compte GitHub ou Google. Pas de formulaire à rallonge.",
                },
                {
                  icon: <Star className="size-6" />,
                  step: "02",
                  title: "Construis ton profil",
                  description:
                    "Tes projets, tes technos, ta disponibilité. On importe tes repos GitHub automatiquement.",
                },
                {
                  icon: <Zap className="size-6" />,
                  step: "03",
                  title: "Sois repéré",
                  description:
                    "Reçois des offres qui correspondent à tes compétences. Candidature en un clic.",
                },
              ].map(({ icon, step, title, description }) => (
                <div key={step} className="text-center">
                  <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {icon}
                  </div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Étape {step}
                  </p>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section recruteurs ─────────────────────────────────── */}
        <section id="recruteurs" className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {/* Header */}
            <div className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5 text-sm text-violet-600">
                <Briefcase className="size-3.5" />
                Espace recruteurs
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Trouvez vos futurs développeurs
              </h2>
              <p className="mx-auto max-w-xl text-muted-foreground">
                Adoptez Ton Dev est sur invitation pour les recruteurs.
                Remplissez le formulaire — nous créons votre accès sous 48&nbsp;h.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Pourquoi choisir ATD */}
              <div className="space-y-5">
                <h3 className="text-lg font-semibold text-foreground">
                  Pourquoi choisir Adopte Ton Dev ?
                </h3>

                {[
                  {
                    icon: <Target className="size-5 text-violet-500" />,
                    title: "Profils orientés compétences",
                    desc: "Chaque développeur expose ses projets réels, sa stack et ses contributions open-source — plus de CV vides.",
                  },
                  {
                    icon: <Filter className="size-5 text-violet-500" />,
                    title: "Filtrage ultra-précis",
                    desc: "Recherchez par langage, framework, niveau, disponibilité, localisation ou remote. Trouvez exactement ce dont vous avez besoin.",
                  },
                  {
                    icon: <Zap className="size-5 text-violet-500" />,
                    title: "Matching automatique",
                    desc: "Notre algorithme calcule un score de compatibilité entre vos offres et les profils — vous voyez en priorité les meilleurs candidats.",
                  },
                  {
                    icon: <Clock className="size-5 text-violet-500" />,
                    title: "Réduction du temps de recrutement",
                    desc: "Messagerie directe intégrée, historique des candidatures centralisé — plus d'allers-retours par email.",
                  },
                  {
                    icon: <Star className="size-5 text-violet-500" />,
                    title: "Spécialisé juniors",
                    desc: "Stage, alternance, premier emploi — une plateforme dédiée aux profils en début de carrière, motivés et à fort potentiel.",
                  },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex gap-4">
                    <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                      {icon}
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-foreground">{title}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA card */}
              <div className="flex flex-col justify-center">
                <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-background to-primary/5 p-8">
                  <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Briefcase className="size-7 text-violet-500" />
                  </div>

                  <h3 className="mb-2 text-xl font-semibold text-foreground">
                    Accès recruteur sur demande
                  </h3>
                  <p className="mb-6 text-muted-foreground">
                    Nous sélectionnons les entreprises partenaires pour garantir
                    une expérience de qualité aux développeurs. Remplissez le
                    formulaire pour rejoindre la plateforme.
                  </p>

                  <ul className="mb-8 space-y-2.5">
                    {[
                      "Réponse garantie sous 48 h ouvrées",
                      "Publication d'offres stage & alternance",
                      "Accès à la recherche de profils qualifiés",
                      "Messagerie directe avec les candidats",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2.5 text-sm text-foreground/80"
                      >
                        <CheckCircle2 className="size-4 shrink-0 text-violet-500" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    size="lg"
                    className="h-11 w-full bg-violet-600 text-base hover:bg-violet-700"
                  >
                    <Link href="/recruteurs">
                      Demander un accès recruteur
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>

                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Aucun engagement · Accès gratuit pour commencer
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA final ──────────────────────────────────────────── */}
        <section className="py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-12 ring-1 ring-border">
              <Users className="mx-auto mb-6 size-10 text-primary" />
              <h2 className="mb-4 text-3xl font-bold tracking-tight">
                Prêt à te lancer ?
              </h2>
              <p className="mb-8 text-muted-foreground">
                Rejoins la plateforme pensée pour les développeurs juniors qui
                méritent leur chance.
              </p>
              <Button asChild size="lg" className="h-11 px-8 text-base">
                <Link href="/sign-in">
                  Créer mon profil gratuitement
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-muted/20 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium">
            <div className="flex size-5 items-center justify-center rounded-md bg-primary">
              <Code2 className="size-3 text-primary-foreground" />
            </div>
            Adopte Ton Dev
          </Link>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Adopte Ton Dev · Tous droits réservés
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/a-propos" className="hover:text-foreground">À propos</Link>
            <Link href="/cgu" className="hover:text-foreground">CGU</Link>
            <Link href="/confidentialite" className="hover:text-foreground">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

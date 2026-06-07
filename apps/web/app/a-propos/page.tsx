import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "./profile-avatar";
import {
  Code2,
  Mail,
  ArrowRight,
  Heart,
  Lightbulb,
  Rocket,
  Users,
  Quote,
} from "lucide-react";

export const metadata = {
  title: "À propos",
  description:
    "L'histoire derrière Adopte Ton Dev — pourquoi j'ai créé cette plateforme et ma vision pour les développeurs juniors.",
};

const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/arthur-plp", // ← remplace par ton handle
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/arthur-philippe", // ← remplace par ton handle
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: "mailto:arthur.philippe21@gmail.com",
    icon: <Mail className="size-4" />,
  },
];

const TIMELINE = [
  {
    year: "2022",
    title: "Les galères commencent",
    body: "Fin de licence, je cherche une alternance en développement web. Des dizaines de candidatures, peu de réponses. Les plateformes me demandent 3 ans d'expérience pour un poste junior. J'ai le sentiment d'être invisible.",
    icon: "😤",
  },
  {
    year: "2023",
    title: "Je décroche enfin",
    body: "Après des mois d'efforts, une entreprise me fait confiance. Pas grâce à mon CV — grâce à mes projets GitHub. Ce déclic change ma vision du recrutement : ce qui compte, c'est ce qu'on sait faire, pas ce qu'on a fait officiellement.",
    icon: "🎯",
  },
  {
    year: "2024",
    title: "L'idée prend forme",
    body: "En master, je vois mes camarades vivre les mêmes galères. Je réalise que le problème est structurel : les outils de recrutement ne sont pas faits pour les juniors. Je commence à imaginer Adopte Ton Dev.",
    icon: "💡",
  },
  {
    year: "2025",
    title: "La plateforme naît",
    body: "En alternance, je construis la plateforme que j'aurais voulu avoir. Une stack moderne, une architecture propre, et une seule obsession : que plus aucun développeur compétent ne soit invisible faute d'expérience.",
    icon: "🚀",
  },
];

const VALUES = [
  {
    icon: <Heart className="size-5 text-rose-500" />,
    bg: "bg-rose-500/10",
    title: "Compétences avant tout",
    body: "Un projet GitHub vaut mille lignes de CV. On évalue ce que tu sais faire, pas ce que tu as fait officiellement.",
  },
  {
    icon: <Lightbulb className="size-5 text-amber-500" />,
    bg: "bg-amber-500/10",
    title: "Transparence totale",
    body: "Pas de candidatures dans le vide. Chaque interaction est tracée, chaque statut communiqué. Le silence, c'est terminé.",
  },
  {
    icon: <Users className="size-5 text-primary" />,
    bg: "bg-primary/10",
    title: "Une communauté, pas un marché",
    body: "Les développeurs ne sont pas des ressources. Ils ont des projets, des ambitions, des histoires. Cette plateforme leur rend leur dignité.",
  },
  {
    icon: <Rocket className="size-5 text-violet-500" />,
    bg: "bg-violet-500/10",
    title: "Gratuit pour toujours côté dev",
    body: "Aucun jeune développeur ne devrait payer pour trouver son premier job. Ce modèle ne changera pas.",
  },
];

export default function AProposPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.85_0.08_264/30%),transparent)]"
          />
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="flex flex-col items-center gap-10 md:flex-row md:items-start md:gap-16">
              {/* Photo */}
              <div className="shrink-0">
                <div className="relative">
                  <div className="size-40 overflow-hidden rounded-3xl border-4 border-background shadow-xl sm:size-48">
                    <ProfileAvatar />
                  </div>
                  {/* Badge disponible */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-background px-3 py-1 text-xs font-medium shadow-sm">
                    🎓 Master · Alternance
                  </div>
                </div>
              </div>

              {/* Intro */}
              <div className="text-center md:text-left">
                <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
                  Le créateur
                </p>
                <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  Arthur Philippe
                </h1>
                <p className="mb-6 text-lg text-muted-foreground">
                  Développeur fullstack en alternance, créateur d'Adopte Ton Dev.
                  J'ai vécu la galère du recrutement junior — j'ai décidé de la résoudre.
                </p>

                {/* Liens sociaux */}
                <div className="flex flex-wrap justify-center gap-3 md:justify-start">
                  {SOCIAL_LINKS.map(({ label, href, icon }) => (
                    <Link
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {icon}
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Citation ──────────────────────────────────────────────── */}
        <section className="border-y border-border/60 bg-muted/30 py-14">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Quote className="mx-auto mb-4 size-8 text-primary/40" />
            <blockquote className="text-xl font-medium italic text-foreground sm:text-2xl">
              "J'ai postulé à plus de 60 entreprises avant de décrocher mon
              alternance. Pas parce que je n'étais pas compétent — parce que
              personne ne regardait mes projets."
            </blockquote>
            <p className="mt-4 text-sm text-muted-foreground">— Arthur, fondateur d'Adopte Ton Dev</p>
          </div>
        </section>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Comment tout a commencé
              </h2>
              <p className="mt-3 text-muted-foreground">
                Une histoire vraie, partagée par des milliers de développeurs juniors.
              </p>
            </div>

            <div className="relative space-y-0">
              {/* Ligne verticale */}
              <div className="absolute left-6 top-4 hidden h-[calc(100%-2rem)] w-px bg-border sm:block" />

              {TIMELINE.map(({ year, title, body, icon }, i) => (
                <div key={i} className="relative flex gap-6 pb-10 last:pb-0">
                  {/* Icône */}
                  <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-2xl shadow-sm">
                    {icon}
                  </div>
                  {/* Contenu */}
                  <div className="pt-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {year}
                    </p>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
                    <p className="text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Valeurs ───────────────────────────────────────────────── */}
        <section className="bg-muted/30 py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Ce en quoi je crois
              </h2>
              <p className="mt-3 text-muted-foreground">
                Les principes qui guident chaque décision sur cette plateforme.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {VALUES.map(({ icon, bg, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
                >
                  <div className={`mb-4 inline-flex size-10 items-center justify-center rounded-xl ${bg}`}>
                    {icon}
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stack technique ───────────────────────────────────────── */}
        <section className="py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Code2 className="size-3.5" />
              Construit par un dev, pour des devs
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Une stack moderne de A à Z
            </h2>
            <p className="mb-10 text-muted-foreground">
              Adopte Ton Dev est mon projet de master — une architecture
              micro-services complète que je développe en parallèle de mon
              alternance. Chaque ligne de code est là pour une raison.
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Next.js 15",
                "NestJS",
                "TypeScript",
                "PostgreSQL",
                "Prisma",
                "BetterAuth",
                "RabbitMQ",
                "Redis",
                "Stripe",
                "Turborepo",
                "Docker",
                "GitHub Actions",
              ].map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="pb-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-12 text-center ring-1 ring-border">
              <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Tu partages cette vision ?
              </h2>
              <p className="mb-8 text-muted-foreground">
                Rejoins la plateforme en tant que développeur, ou contacte-moi
                directement si tu veux échanger sur le projet.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="h-11 px-6 text-base">
                  <Link href="/sign-in?tab=signup">
                    Créer mon profil gratuitement
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 px-6 text-base">
                  <Link href="mailto:arthur.philippe21@gmail.com">
                    <Mail className="size-4" />
                    Me contacter
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

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
            <Link href="/cgu" className="hover:text-foreground">CGU</Link>
            <Link href="/confidentialite" className="hover:text-foreground">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

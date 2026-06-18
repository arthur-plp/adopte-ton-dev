import Link from "next/link";
import { Code2 } from "lucide-react";

const LINKS = [
  {
    heading: "Plateforme",
    items: [
      { label: "Offres d'emploi", href: "/offres" },
      { label: "Profils développeurs", href: "/developpeurs" },
      { label: "Accès recruteur", href: "/recruteurs" },
    ],
  },
  {
    heading: "Entreprise",
    items: [
      { label: "À propos", href: "/a-propos" },
      { label: "Nous contacter", href: "/recruteurs" },
    ],
  },
  {
    heading: "Légal",
    items: [
      { label: "CGU", href: "/cgu" },
      { label: "Politique de confidentialité", href: "/confidentialite" },
      { label: "Mentions légales", href: "/mentions-legales" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary shadow-sm">
                <Code2 className="size-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">Adopte Ton Dev</span>
            </Link>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              La plateforme de recrutement centrée sur les compétences réelles des
              développeurs juniors — stagiaires, alternants, premiers emplois.
            </p>
            <p className="text-xs text-muted-foreground">
              100&nbsp;% gratuit pour les développeurs.
            </p>
          </div>

          {/* Link columns */}
          {LINKS.map(({ heading, items }) => (
            <div key={heading}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">
                {heading}
              </p>
              <ul className="space-y-2.5">
                {items.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Adopte Ton Dev · Tous droits réservés
          </p>
          <p className="text-xs text-muted-foreground">
            Fait avec ❤️ pour les devs juniors
          </p>
        </div>
      </div>
    </footer>
  );
}

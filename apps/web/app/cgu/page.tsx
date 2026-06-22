import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function CguPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Conditions Générales d&apos;Utilisation
        </h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Dernière mise à jour : juin 2026
        </p>

        <div className="prose prose-sm max-w-none text-foreground/80 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul>li]:mb-1">
          <h2>1. Présentation du service</h2>
          <p>
            Adopte Ton Dev (ci-après « la Plateforme ») est un service en ligne
            de mise en relation entre des développeurs web juniors (stagiaires,
            alternants, jeunes diplômés, personnes en reconversion) et des
            recruteurs. La Plateforme est éditée par Arthur Philippe, étudiant
            dans le cadre d&apos;un projet pédagogique.
          </p>

          <h2>2. Acceptation des CGU</h2>
          <p>
            L&apos;utilisation de la Plateforme implique l&apos;acceptation
            pleine et entière des présentes CGU. Si vous n&apos;acceptez pas ces
            conditions, veuillez ne pas utiliser la Plateforme.
          </p>

          <h2>3. Inscription et comptes</h2>
          <p>
            L&apos;inscription s&apos;effectue via OAuth (GitHub ou Google).
            Deux rôles sont disponibles :
          </p>
          <ul>
            <li>
              <strong>Développeur</strong> : accès gratuit et illimité à la
              création de profil, au dépôt de candidatures et à la messagerie.
            </li>
            <li>
              <strong>Recruteur</strong> : accès sur demande, soumis à
              validation. Un abonnement peut être requis pour certaines
              fonctionnalités avancées.
            </li>
          </ul>
          <p>
            Chaque utilisateur est responsable de la confidentialité de son
            compte et de l&apos;exactitude des informations fournies.
          </p>

          <h2>4. Règles d&apos;utilisation</h2>
          <p>Il est interdit de :</p>
          <ul>
            <li>
              publier des contenus faux, trompeurs, illicites ou portant
              atteinte aux droits de tiers ;
            </li>
            <li>
              utiliser la Plateforme à des fins de spam ou de démarchage
              commercial non sollicité ;
            </li>
            <li>
              tenter d&apos;accéder à des données qui ne vous sont pas
              destinées ;
            </li>
            <li>
              usurper l&apos;identité d&apos;une autre personne ou entreprise.
            </li>
          </ul>

          <h2>5. Propriété intellectuelle</h2>
          <p>
            Les contenus publiés par les utilisateurs (profils, projets,
            offres) restent leur propriété. En les publiant sur la Plateforme,
            ils accordent à Adopte Ton Dev une licence non exclusive
            d&apos;affichage et de référencement aux fins du service.
          </p>
          <p>
            Le code source, les designs et les textes propres à la Plateforme
            sont la propriété de l&apos;éditeur.
          </p>

          <h2>6. Limitation de responsabilité</h2>
          <p>
            La Plateforme est fournie « en l&apos;état », sans garantie
            d&apos;adéquation à un usage particulier. L&apos;éditeur ne peut
            être tenu responsable d&apos;un recrutement abouti ou non, ni des
            contenus publiés par des tiers.
          </p>

          <h2>7. Suspension et résiliation</h2>
          <p>
            L&apos;éditeur se réserve le droit de suspendre ou supprimer tout
            compte ne respectant pas les présentes CGU, sans préavis.
            L&apos;utilisateur peut supprimer son compte à tout moment depuis
            ses paramètres.
          </p>

          <h2>8. Modifications</h2>
          <p>
            Les CGU peuvent être modifiées à tout moment. Les utilisateurs
            seront informés par email en cas de changement substantiel. La
            poursuite de l&apos;utilisation du service vaut acceptation des
            nouvelles conditions.
          </p>

          <h2>9. Droit applicable</h2>
          <p>
            Les présentes CGU sont régies par le droit français. Tout litige
            relève de la compétence des tribunaux français.
          </p>

          <h2>10. Contact</h2>
          <p>
            Pour toute question relative aux présentes CGU :{" "}
            <Link
              href="mailto:arthur.philippe21@gmail.com"
              className="text-primary hover:underline"
            >
              arthur.philippe21@gmail.com
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

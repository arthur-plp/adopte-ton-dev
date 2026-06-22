import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function ConfidentialitePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Politique de confidentialité
        </h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Dernière mise à jour : juin 2026
        </p>

        <div className="prose prose-sm max-w-none text-foreground/80 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul>li]:mb-1">
          <h2>1. Responsable du traitement</h2>
          <p>
            Arthur Philippe — arthur.philippe21@gmail.com — est responsable du
            traitement des données personnelles collectées via Adopte Ton Dev.
          </p>

          <h2>2. Données collectées</h2>
          <p>
            Nous collectons uniquement les données nécessaires au fonctionnement
            du service (principe de minimisation) :
          </p>
          <ul>
            <li>
              <strong>Compte</strong> : adresse email, nom, avatar — fournis par
              GitHub ou Google via OAuth.
            </li>
            <li>
              <strong>Profil développeur</strong> : prénom, nom, titre,
              biographie, localisation, disponibilité, liens (GitHub, portfolio,
              LinkedIn), compétences, technologies, projets.
            </li>
            <li>
              <strong>Profil recruteur</strong> : prénom, nom, entreprise,
              poste.
            </li>
            <li>
              <strong>Activité</strong> : candidatures, messages, notifications.
            </li>
            <li>
              <strong>Paiement</strong> : traité exclusivement par Stripe — nous
              ne stockons aucun numéro de carte.
            </li>
          </ul>

          <h2>3. Finalités et bases légales</h2>
          <ul>
            <li>
              Fourniture du service de mise en relation (exécution du contrat).
            </li>
            <li>
              Envoi d&apos;emails transactionnels (intérêt légitime /
              exécution du contrat).
            </li>
            <li>
              Statistiques d&apos;utilisation anonymisées (intérêt légitime).
            </li>
            <li>
              Emails non transactionnels : uniquement sur consentement explicite.
            </li>
          </ul>

          <h2>4. Sous-traitants</h2>
          <p>
            Nous faisons appel aux prestataires suivants, chacun disposant de
            sa propre politique de confidentialité :
          </p>
          <ul>
            <li>
              <strong>GitHub / Google</strong> — authentification OAuth
            </li>
            <li>
              <strong>Stripe</strong> — paiement en ligne (USA, clauses
              contractuelles types UE)
            </li>
            <li>
              <strong>Resend</strong> — envoi d&apos;emails transactionnels
            </li>
            <li>
              <strong>CloudAMQP</strong> — messagerie asynchrone interne
            </li>
          </ul>

          <h2>5. Durée de conservation</h2>
          <ul>
            <li>Données de compte : jusqu&apos;à la suppression du compte.</li>
            <li>
              Candidatures et messages : 2 ans après la dernière activité.
            </li>
            <li>Logs techniques : 90 jours.</li>
          </ul>

          <h2>6. Vos droits (RGPD)</h2>
          <p>
            Vous disposez des droits suivants sur vos données : accès,
            rectification, effacement, limitation, portabilité et opposition.
            Pour les exercer, contactez-nous à{" "}
            <Link
              href="mailto:arthur.philippe21@gmail.com"
              className="text-primary hover:underline"
            >
              arthur.philippe21@gmail.com
            </Link>
            . Nous répondons sous 30 jours. Vous pouvez également saisir la
            CNIL (cnil.fr).
          </p>

          <h2>7. Sécurité</h2>
          <p>
            Les données sont chiffrées en transit (HTTPS/TLS). Les mots de
            passe ne sont pas gérés directement — l&apos;authentification est
            déléguée à GitHub/Google. Les secrets applicatifs ne sont jamais
            stockés dans le code source.
          </p>

          <h2>8. Cookies</h2>
          <p>
            La Plateforme utilise uniquement des cookies de session
            (authentification). Aucun cookie publicitaire ou traceur tiers
            n&apos;est déposé.
          </p>

          <h2>9. Modifications</h2>
          <p>
            Cette politique peut évoluer. En cas de changement substantiel, les
            utilisateurs seront notifiés par email.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
